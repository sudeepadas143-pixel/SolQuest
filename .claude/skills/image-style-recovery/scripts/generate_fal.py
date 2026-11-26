#!/usr/bin/env python3
"""Generate images on fal.ai, optionally with reference images for style. Standard library only (+ Pillow for refs).

Usage:
  python3 -I generate_fal.py --model flux2 --prompt "..." [--ref ref.png ...] [--n 4] [--seed 1]
                             [--aspect 16:9 | --size 1344x768] [--out DIR] [--name round1]
  python3 -I generate_fal.py --schema fal-ai/flux-2/edit        # print an endpoint's input fields

Models (with --ref the edit/reference variant is used automatically):
  flux2   fal-ai/flux-2        / fal-ai/flux-2/edit          FLUX.2: strong style transfer from references
  nano    fal-ai/nano-banana-pro / fal-ai/nano-banana-pro/edit  Google Nano Banana Pro: follows instructions well
  or --endpoint any/fal/endpoint-id with --extra '{"field": value}'

Auth: header "Authorization: Key <FAL_KEY>". Uses $FAL_KEY if set; in Claude cloud sessions the key is a saved
network secret injected by the proxy, so a placeholder is sent and replaced. Each image costs money on the
user's fal account: confirm the count with the user before running.
Writes images plus a .json sidecar (endpoint, prompt, seed, settings) per run into --out.
"""
import argparse, base64, io, json, mimetypes, os, sys, time, urllib.request, urllib.error
from pathlib import Path

MODELS = {"flux2": ("fal-ai/flux-2", "fal-ai/flux-2/edit"),
          "nano": ("fal-ai/nano-banana-pro", "fal-ai/nano-banana-pro/edit")}
FLUX_PRESETS = {"1:1": "square_hd", "4:3": "landscape_4_3", "3:4": "portrait_4_3",
                "16:9": "landscape_16_9", "9:16": "portrait_16_9"}


def http(url, payload=None, timeout=600):
    key = os.environ.get("FAL_KEY") or "proxy-injected"
    req = urllib.request.Request(url, data=json.dumps(payload).encode() if payload is not None else None,
                                 headers={"Authorization": f"Key {key}", "Content-Type": "application/json",
                                          "User-Agent": "image-style-recovery/1.0"},
                                 method="POST" if payload is not None else "GET")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.read()
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", "replace")[:2000]
        if "balance" in body.lower() or "billing" in body.lower():
            sys.exit(f"fal account has no credit: top up at https://fal.ai/dashboard/billing, then rerun.\n{body}")
        hint = {401: "key missing or wrong", 403: "key lacks access or host blocked", 402: "out of fal credit",
                422: "invalid input: check --schema", 429: "rate limited"}.get(e.code, "")
        sys.exit(f"fal error {e.code} {hint}\n{body}")


def ref_to_data_uri(path, max_edge=1536):
    from PIL import Image
    im = Image.open(path); im.load()
    if max(im.size) > max_edge:
        im.thumbnail((max_edge, max_edge))
    buf = io.BytesIO()
    if im.mode in ("RGBA", "LA", "P"):
        im.convert("RGBA").save(buf, "PNG"); mt = "image/png"
    else:
        im.convert("RGB").save(buf, "JPEG", quality=93); mt = "image/jpeg"
    return f"data:{mt};base64,{base64.b64encode(buf.getvalue()).decode()}"


def flux_size(aspect, size):
    if size:
        w, h = (int(v) for v in size.lower().split("x"))
        return {"width": w // 16 * 16, "height": h // 16 * 16}
    if aspect in FLUX_PRESETS:
        return FLUX_PRESETS[aspect]
    if aspect:
        a, b = (float(v) for v in aspect.split(":")); r = a / b
        h = (1048576 / r) ** .5
        return {"width": int(h * r) // 16 * 16, "height": int(h) // 16 * 16}
    return None


def save_image(item, out, stem):
    url = item.get("url") if isinstance(item, dict) else item
    if url.startswith("data:"):
        head, b64 = url.split(",", 1); data = base64.b64decode(b64)
        ext = mimetypes.guess_extension(head[5:].split(";")[0]) or ".png"
    else:
        with urllib.request.urlopen(url, timeout=300) as r:
            data = r.read()
        ct = (item.get("content_type") if isinstance(item, dict) else None) or mimetypes.guess_type(url)[0] or "image/png"
        ext = mimetypes.guess_extension(ct) or Path(url).suffix or ".png"
    p = out / f"{stem}{'.jpg' if ext == '.jpe' else ext}"
    p.write_bytes(data)
    return str(p)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--model", choices=sorted(MODELS), default="flux2")
    ap.add_argument("--endpoint", help="raw fal endpoint id (overrides --model)")
    ap.add_argument("--prompt"); ap.add_argument("--prompt-file")
    ap.add_argument("--ref", action="append", default=[], help="reference image (repeatable)")
    ap.add_argument("--n", type=int, default=1, help="images per request, 1-4")
    ap.add_argument("--seed", type=int); ap.add_argument("--aspect"); ap.add_argument("--size")
    ap.add_argument("--format", default="png", choices=["png", "jpeg", "webp"])
    ap.add_argument("--extra", help="JSON object merged into the request")
    ap.add_argument("--out", default="fal_out"); ap.add_argument("--name", default="gen")
    ap.add_argument("--schema", metavar="ENDPOINT", help="print an endpoint's input schema and exit")
    a = ap.parse_args()

    if a.schema:
        j = json.loads(urllib.request.urlopen(f"https://fal.ai/api/openapi/queue/openapi.json?endpoint_id={a.schema}", timeout=60).read())
        for name, s in j.get("components", {}).get("schemas", {}).items():
            if name.endswith("Input"):
                print(name, "required:", s.get("required"))
                for k, v in s.get("properties", {}).items():
                    print(f"  {k}: {v.get('type') or [x.get('type') or x.get('$ref', '').split('/')[-1] for x in v.get('anyOf', [])]}"
                          f"{'  default=' + json.dumps(v['default']) if 'default' in v else ''}"
                          f"{'  enum=' + json.dumps(v['enum']) if 'enum' in v else ''}  {(v.get('description') or '')[:100]}")
        return

    prompt = Path(a.prompt_file).read_text().strip() if a.prompt_file else a.prompt
    if not prompt:
        sys.exit("--prompt or --prompt-file is required")
    endpoint = a.endpoint or MODELS[a.model][1 if a.ref else 0]
    body = {"prompt": prompt, "num_images": max(1, min(4, a.n)), "output_format": a.format}
    if a.seed is not None: body["seed"] = a.seed
    if a.ref: body["image_urls"] = [ref_to_data_uri(r) for r in a.ref]
    if "nano-banana" in endpoint:
        if a.aspect: body["aspect_ratio"] = a.aspect
    elif "flux" in endpoint:
        sz = flux_size(a.aspect, a.size)
        if sz: body["image_size"] = sz
    if a.extra: body.update(json.loads(a.extra))

    out = Path(a.out); out.mkdir(parents=True, exist_ok=True)
    t0 = time.time()
    res = json.loads(http(f"https://fal.run/{endpoint}", body))
    imgs = res.get("images") or ([res["image"]] if res.get("image") else [])
    if not imgs:
        sys.exit("no images in response: " + json.dumps(res)[:1500])
    stamp = time.strftime("%H%M%S")
    files = [save_image(im, out, f"{a.name}_{stamp}_{i}") for i, im in enumerate(imgs)]
    meta = {"endpoint": endpoint, "prompt": prompt, "seed": res.get("seed", a.seed), "refs": a.ref,
            "settings": {k: v for k, v in body.items() if k not in ("prompt", "image_urls")},
            "files": files, "seconds": round(time.time() - t0, 1),
            "nsfw_flags": res.get("has_nsfw_concepts"), "model_description": res.get("description")}
    Path(out / f"{a.name}_{stamp}.json").write_text(json.dumps(meta, indent=2))
    print(json.dumps(meta, indent=2))


if __name__ == "__main__":
    main()
