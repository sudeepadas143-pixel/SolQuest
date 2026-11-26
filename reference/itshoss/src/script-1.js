
/* ---------- project links + CA from the admin panel ----------
   Read ONLY through the get_project_config RPC with the public anon key (direct table reads are blocked).
   Kept out of the scene script so a failed request never touches the 3D. */
/* ---------- SITE: links + CA (edit here) ---------- */
const SITE = {
  contract_address: "",
  twitter_url: "https://x.com/itshosspf",
  community_url: "",
  telegram_url: "",
  buy_platform: "pumpfun",
  chart_platform: "dexscreener",
  social_links: [],
};
const $ = id => document.getElementById(id);
async function loadProjectConfig() {
  const ca = SITE.contract_address.trim();
  return { ...SITE, dexscreener_url: ca ? "https://dexscreener.com/solana/" + ca : null };
}

// Buy platform selected in admin: Pump.fun. Chart platform: DexScreener. Logos kept exactly as supplied by the admin panel.
const BUY = {"id":"pumpfun","template":"https://pump.fun/coin/{CA}","label":"Buy on Pump.fun","icon":"data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDIwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxwYXRoIGQ9Ik0yMS44ODU1IDE4NC4yNDdDLTIuMDE2MDMgMTYyLjA3NiAtMy40MTg1MyAxMjQuNzI2IDE4Ljc1MyAxMDAuODI0TDk0Ljc2MDkgMTguODg1NUMxMTYuOTMyIC01LjAxNjA1IDE1NC4yODIgLTYuNDE4NTUgMTc4LjE4NCAxNS43NTI5QzIwMi4wODUgMzcuOTI0NCAyMDMuNDg4IDc1LjI3NCAxODEuMzE2IDk5LjE3NTZMMTA1LjMwOCAxODEuMTE1QzgzLjEzNjcgMjA1LjAxNiA0NS43ODcxIDIwNi40MTkgMjEuODg1NSAxODQuMjQ3WiIgZmlsbD0id2hpdGUiLz4KPHBhdGggZmlsbC1ydWxlPSJldmVub2RkIiBjbGlwLXJ1bGU9ImV2ZW5vZGQiIGQ9Ik0xOC43NTMgMTAwLjgyNEMtMy40MTg1MyAxMjQuNzI2IC0yLjAxNjAzIDE2Mi4wNzYgMjEuODg1NSAxODQuMjQ3QzQ1Ljc4NzEgMjA2LjQxOSA4My4xMzY3IDIwNS4wMTYgMTA1LjMwOCAxODEuMTE1TDE0NS44MSAxMzcuNDUyTDU5LjI1NDkgNTcuMTYyMUwxOC43NTMgMTAwLjgyNFpNNDAuNjkwOCAxMjMuODQ3QzQxLjQyMDkgMTIyLjk0NiA0MS4yODI4IDEyMS42MjUgNDAuMzgyNCAxMjAuODk1QzM5LjQ4MiAxMjAuMTY1IDM4LjE2MDMgMTIwLjMwMyAzNy40MzAyIDEyMS4yMDNMMzQuOTQ2MyAxMjQuMjY3QzM0LjIxNjIgMTI1LjE2NyAzNC4zNTQzIDEyNi40ODkgMzUuMjU0NyAxMjcuMjE5QzM2LjE1NTEgMTI3Ljk0OSAzNy40NzY4IDEyNy44MTEgMzguMjA2OCAxMjYuOTFMNDAuNjkwOCAxMjMuODQ3Wk0zNC41NTI1IDEzNS43ODFDMzQuNzY1MyAxMzQuNjQxIDM0LjAxNCAxMzMuNTQ1IDMyLjg3NDUgMTMzLjMzMkMzMS43MzUgMTMzLjEyIDMwLjYzODggMTMzLjg3MSAzMC40MjYxIDEzNS4wMUMyOS4yODE0IDE0MS4xNDIgMjkuNzAxMyAxNDcuMjM5IDMxLjQ5MTYgMTUyLjcxOEMzMS44NTE2IDE1My44MiAzMy4wMzY3IDE1NC40MjEgMzQuMTM4NSAxNTQuMDYxQzM1LjI0MDQgMTUzLjcwMSAzNS44NDE3IDE1Mi41MTYgMzUuNDgxNiAxNTEuNDE0QzMzLjkxNTkgMTQ2LjYyMyAzMy41MzM1IDE0MS4yNCAzNC41NTI1IDEzNS43ODFaTTM5LjYyNTcgMTYwLjI3QzM4LjgxODQgMTU5LjQzOCAzNy40ODk3IDE1OS40MTggMzYuNjU3OCAxNjAuMjI1QzM1LjgyNTkgMTYxLjAzMiAzNS44MDU5IDE2Mi4zNjEgMzYuNjEzMSAxNjMuMTkzTDQwLjA4OTIgMTY2Ljc3NUM0MC44OTY0IDE2Ny42MDcgNDIuMjI1MiAxNjcuNjI3IDQzLjA1NzEgMTY2LjgyQzQzLjg4OSAxNjYuMDEzIDQzLjkwOSAxNjQuNjg0IDQzLjEwMTggMTYzLjg1MkwzOS42MjU3IDE2MC4yN1oiIGZpbGw9IiM1RkNCODgiLz4KPHBhdGggZmlsbC1ydWxlPSJldmVub2RkIiBjbGlwLXJ1bGU9ImV2ZW5vZGQiIGQ9Ik0zLjA2NjIzIDEzOC4xNTJDNS43NjgxMyAxNDcuMDM1IDEwLjc4NjEgMTU1LjM0MyAxOC4wODQgMTYyLjExMkM0MC4wNzM1IDE4Mi41MSA3NC40MzUxIDE4MS4yMiA5NC44MzI5IDE1OS4yM0wxNjEuNTYzIDg3LjI5MzRDMTgxLjk2MSA2NS4zMDQgMTgwLjY3IDMwLjk0MjQgMTU4LjY4MSAxMC41NDQ2QzE1My44MDggNi4wMjQ2OSAxNDguMzI4IDIuNTY5NjggMTQyLjUyNyAwLjE2ODg0N0MxNTUuMzc4IDEuMTQwNDMgMTY4LjAwMSA2LjMwNzQ0IDE3OC4xODQgMTUuNzUyOUMyMDIuMDg1IDM3LjkyNDQgMjAzLjQ4OCA3NS4yNzQgMTgxLjMxNiA5OS4xNzU2TDEwNS4zMDggMTgxLjExNUM4My4xMzY3IDIwNS4wMTYgNDUuNzg3MSAyMDYuNDE5IDIxLjg4NTUgMTg0LjI0N0M4LjYwNzYgMTcxLjkzIDIuMjczMDYgMTU0LjkyOSAzLjA2NjIzIDEzOC4xNTJaIiBmaWxsPSIjNjI5MzkzIiBmaWxsLW9wYWNpdHk9IjAuNCIvPgo8cGF0aCBmaWxsLXJ1bGU9ImV2ZW5vZGQiIGNsaXAtcnVsZT0iZXZlbm9kZCIgZD0iTTE0MC4zNDEgMTMwLjIzMkwxNzQuNzc2IDkzLjEwOTJDMTkzLjU5OCA3Mi44MTk0IDE5Mi40MDcgNDEuMTEzOCAxNzIuMTE3IDIyLjI5MjdDMTUxLjgyNyAzLjQ3MTUxIDEyMC4xMjIgNC42NjIwNiAxMDEuMzAxIDI0Ljk1MThMNjYuODY1MSA2Mi4wNzQ0TDE0MC4zNDEgMTMwLjIzMlpNMTgxLjMxNiA5OS4xNzU2QzIwMy40ODggNzUuMjc0IDIwMi4wODUgMzcuOTI0NCAxNzguMTg0IDE1Ljc1MjlDMTU0LjI4MiAtNi40MTg1NSAxMTYuOTMyIC01LjAxNjA1IDk0Ljc2MDkgMTguODg1NUw1NC4yNTkgNjIuNTQ3OEwxNDAuODE0IDE0Mi44MzhMMTgxLjMxNiA5OS4xNzU2WiIgZmlsbD0iIzFEMzkzNCIvPgo8cGF0aCBmaWxsLXJ1bGU9ImV2ZW5vZGQiIGNsaXAtcnVsZT0iZXZlbm9kZCIgZD0iTTI1LjI5MjcgMTA2Ljg5MUw2MC43OTg4IDY4LjYxNDFMNTQuMjU5IDYyLjU0NzhMMTguNzUzIDEwMC44MjRDLTMuNDE4NTMgMTI0LjcyNiAtMi4wMTYwMyAxNjIuMDc2IDIxLjg4NTUgMTg0LjI0N0M0NS43ODcxIDIwNi40MTkgODMuMTM2NyAyMDUuMDE2IDEwNS4zMDggMTgxLjExNUwxNDAuODE0IDE0Mi44MzhMMTM0LjI3NSAxMzYuNzcxTDk4Ljc2ODUgMTc1LjA0OEM3OS45NDczIDE5NS4zMzggNDguMjQxNyAxOTYuNTI4IDI3Ljk1MTkgMTc3LjcwN0M3LjY2MjE0IDE1OC44ODYgNi40NzE1OCAxMjcuMTgxIDI1LjI5MjcgMTA2Ljg5MVoiIGZpbGw9IiMxRDM5MzQiLz4KPC9zdmc+","iconBg":null};
const CHART_BRAND = {"id":"dexscreener","host":"dexscreener.com","label":"Chart on DexScreener","icon":"data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgY29sb3I9InJnYigyNTUsIDI1NSwgMjU1KSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBmaWxsLXJ1bGU9ImV2ZW5vZGQiIGNsaXAtcnVsZT0iZXZlbm9kZCIgZD0iTTExLjMxOTQgMS4wMzAzMkMxMC43ODQyIDEuMDc2OTggMTAuMTIwMSAxLjIyNzkyIDkuNTY1NjggMS40MzEwMUM4Ljc3NTI4IDEuNzEzNjkgNy44MjI5NiAyLjI2NTMzIDcuMTQ3ODIgMi44MzA2OEM2LjU3OTcyIDMuMzAyNzMgNS45NDU3NSAzLjk5MTU5IDUuNTQyMzIgNC41NzA2N0M1LjQ1NDQ5IDQuNjk2OTEgNS4zNzc2NSA0LjgwNjY5IDUuMzcyMTYgNC44MTIxOEM1LjM1NTY5IDQuODM0MTMgNC44MjA1MyA0LjQ2MDg5IDQuNTI2ODcgNC4yMTkzOEM0LjM2MjIgNC4wODQ5IDQuMDc0MDQgMy44MjY5MiAzLjg4NzQxIDMuNjUxMjdDMy43MDM1MyAzLjQ3Mjg4IDMuNTUyNTkgMy4zMzI5MiAzLjU1MjU5IDMuMzQxMTVDMy41NTI1OSAzLjM4MjMyIDMuNzcyMTUgMy44OTAwNCAzLjkxMjExIDQuMTY0NDlDNC4yNjg4OSA0Ljg4MDc5IDQuNzEzNDkgNS40NTcxMiA1LjU2NzAyIDYuMzEzMzlDNi42MTI2NSA3LjM2MTc3IDcuNzY1MzIgOC4zMTEzNiA5LjE2NDk5IDkuMjgwMTVDOS43MTY2MyA5LjY2MTYzIDEwLjU0ODIgMTAuMTk0IDEwLjU5MjEgMTAuMTk0QzEwLjYwODYgMTAuMTk0IDEwLjY0NyAxMC4xNjY2IDEwLjY3NzIgMTAuMTM2NEMxMC43NTk1IDEwLjA0NTggMTEuMDM5NSA5Ljg1Mzc0IDExLjIzNDMgOS43NTc2OEMxMS40Nzg2IDkuNjM0MTggMTEuODU3MyA5LjU1NDU5IDEyLjEwMTYgOS41NzM4QzEyLjQ4MDMgOS42MDM5OSAxMi44NjczIDkuNzYzMTcgMTMuMjMyMyAxMC4wNDMxQzEzLjM0MjEgMTAuMTI1NCAxMy40MzgxIDEwLjE5NCAxMy40NDM2IDEwLjE5NEMxMy40NjI4IDEwLjE5NCAxNC4zNDM4IDkuNjM0MTggMTQuNjY3NiA5LjQxNzM3QzE2Ljc5MTggNy45ODIwMiAxOC42NTI2IDYuMzI0MzcgMTkuNTU1NSA1LjA1OTE4QzE5LjkxMjMgNC41NTk2OSAyMC4yMTY5IDMuOTk3MDggMjAuMzg3MSAzLjUzMDUyTDIwLjQ1ODQgMy4zMjc0M0wyMC4xMDk5IDMuNjU2NzZDMTkuNjY1MyA0LjA3MzkyIDE5LjI2NDYgNC40MDMyNSAxOC45MjQzIDQuNjMzNzlDMTguNzc2MSA0LjczMjU5IDE4LjY0NzEgNC44MTQ5MiAxOC42Mzg4IDQuODE0OTJDMTguNjMwNiA0LjgxNDkyIDE4LjU1MzggNC43MTMzOCAxOC40NjU5IDQuNTg3MTNDMTguMjE2MiA0LjIzMDM1IDE3Ljg5MjQgMy44NDA2NCAxNy41NDkzIDMuNDg2NjFDMTUuODE3NSAxLjY5NDQ4IDEzLjYwMjggMC44MjE3NDQgMTEuMzE5NCAxLjAzMDMyWk00LjM3ODY3IDYuNzQ5NzZDNC4wOTg3NCA3LjQ5MzUxIDMuOTgwNzIgOC4yNzg0MiAzLjkzNjgxIDkuNjU4ODhDMy45MDM4OCAxMC42Njg4IDMuODU3MjIgMTEuMjcyNiAzLjc1ODQyIDExLjg5ODRDMy41NDE2MSAxMy4yODE2IDMuMjM2OTggMTQuMjU4NiAyLjU4NjU0IDE1LjYzOUMyLjQ1MjA2IDE1LjkyNDUgMi4zNDc3NyAxNi4xNjMyIDIuMzU2MDEgMTYuMTY4N0MyLjM4ODk0IDE2LjIwNDQgMy4wMjI5MSAxNS43ODE4IDMuNDE1MzcgMTUuNDYzNEMzLjU1ODA4IDE1LjM0NTQgMy44MzUyNyAxNS4wOTU2IDQuMDMyODcgMTQuOTA2M0M0LjIyNzcyIDE0LjcxNjkgNC4zOTIzOSAxNC41NjMyIDQuMzk1MTQgMTQuNTY2QzQuNDAzMzcgMTQuNTc2OSA0LjIzODcgMTUuMzgxMSA0LjE4MzgxIDE1LjU4NjlDMy45Mjg1OCAxNi41MzY1IDMuNTIyNCAxNy40NTg2IDIuOTcwNzYgMTguMzMxNEMyLjc5MjM4IDE4LjYxNCAyLjM5MTY5IDE5LjE4NDkgMi4wNzA1OCAxOS42MTNDMS45OTY0OCAxOS43MTczIDEuOTQ0MzQgMTkuNzk5NiAxLjk1NTMyIDE5Ljc5OTZDMS45NjkwNCAxOS43OTk2IDIuMTM2NDUgMTkuNzIgMi4zMzQwNSAxOS42MjRDMy4zMzMwMyAxOS4xMjcyIDQuMTgxMDcgMTguNDg1IDQuOTg1MTkgMTcuNjA5Nkw1LjIyMTIyIDE3LjM1NDNMNS4yOTUzMiAxNy42NzgyQzUuNDc5MTkgMTguNDcxMyA1LjgxMTI3IDE5LjM2ODggNi4yMjU2OSAyMC4xOTQ4QzYuNDY5OTQgMjAuNjgzMyA2LjkzMTAxIDIxLjUwNjcgNi45NTAyMiAyMS40ODc1QzYuOTU1NzEgMjEuNDg0NyA3LjAwNzg2IDIxLjMzMzggNy4wNzA5OCAyMS4xNTU0QzcuMjAyNzEgMjAuNzY4NCA3LjQ2NjE4IDIwLjE4MTEgNy43MDQ5NSAxOS43NDQ3QzcuODk5OCAxOS4zOTA3IDguMjUxMDkgMTguODE0NCA4LjI3MzA1IDE4LjgxMTZDOC4yODEyOCAxOC44MTE2IDguMzQ3MTUgMTguOTI2OSA4LjQyMTI1IDE5LjA2NjlDOC45MTc5OSAxOS45OTQ1IDkuNjAxMzYgMjAuOTg1MiAxMC42NjM1IDIyLjMxMDhDMTAuOTQzNCAyMi42NTY2IDExLjM1NTEgMjMuMTc1MyAxMS41ODAxIDIzLjQ2MzVDMTEuODAyNCAyMy43NDg5IDExLjk5MTggMjMuOTkwNCAxMiAyMy45OTg2QzEyLjAwNTUgMjQuMDA2OSAxMi4wMzU3IDIzLjk3NjcgMTIuMDY4NiAyMy45MzI4QzEyLjA5ODggMjMuODg4OSAxMi40MjI3IDIzLjQ4MjcgMTIuNzg0OSAyMy4wMzI2QzE0LjMxOTEgMjEuMTI1MiAxNC45MTc0IDIwLjI3OTkgMTUuNTY1MSAxOS4xMDUzQzE1LjY4ODYgMTguODgzIDE1LjczNTIgMTguODE3MSAxNS43NTcyIDE4Ljg0NDZDMTUuODM5NSAxOC45NDM0IDE2LjE4MjYgMTkuNTMwNyAxNi4zNzE5IDE5Ljg5NTdDMTYuNjUxOSAyMC40MzYzIDE2LjgzNTcgMjAuODQ1MyAxNi45NDgzIDIxLjE5MzhDMTcuMDAwNCAyMS4zNDc1IDE3LjA0NzEgMjEuNDczNyAxNy4wNTUzIDIxLjQ3MzdDMTcuMDk5MiAyMS40NzM3IDE3LjU1NzUgMjAuNjUwNCAxNy44NDg0IDIwLjA0NjZDMTguMjM1NCAxOS4yNDUzIDE4LjUwNDQgMTguNTA5NyAxOC42ODgyIDE3Ljc2MDVDMTguNzQwNCAxNy41NDkyIDE4Ljc4NyAxNy4zNzA4IDE4Ljc5MjUgMTcuMzY4QzE4Ljc5OCAxNy4zNjI2IDE4LjkxODggMTcuNDg4OCAxOS4wNjE1IDE3LjY0OEMxOS41NDE4IDE4LjE5MTQgMjAuMjAzMiAxOC43NDg1IDIwLjg2NzMgMTkuMTY4NEMyMS4xODAyIDE5LjM2NiAyMS45ODcxIDE5Ljc5OTYgMjIuMDQ0NyAxOS43OTk2QzIyLjA2MzkgMTkuNzk5NiAyMS45MTU3IDE5LjU4NTYgMjEuNzIwOSAxOS4zMjIxQzIxLjEzMDggMTguNTI5IDIwLjc3NCAxNy45NTI2IDIwLjQ0NDcgMTcuMjYzOEMyMC4wNDQgMTYuNDI0IDE5LjgyMTcgMTUuNzEzMSAxOS42MjQxIDE0LjY0NTZDMTkuNjEwNCAxNC41NjA1IDE5LjYzNzggMTQuNTgyNCAyMC4wMTM4IDE0LjkzOTJDMjAuNDUwMiAxNS4zNTM2IDIwLjc4MjMgMTUuNjMzNiAyMS4wOTc5IDE1Ljg0MjFDMjEuMzIwMiAxNS45OTMxIDIxLjYzMDMgMTYuMTc3IDIxLjY2MDUgMTYuMTc3QzIxLjY3MTUgMTYuMTc3IDIxLjU3ODIgMTUuOTcxMSAyMS40NTQ3IDE1LjcyMTRDMjAuNzYzMSAxNC4zMTYyIDIwLjMzNzcgMTIuODc4MSAyMC4xNzMgMTEuMzc5N0MyMC4xNTEgMTEuMTc5MyAyMC4xMTgxIDEwLjY5OSAyMC4xMDE2IDEwLjMwOTNDMjAuMDIyIDguMzY2MjQgMTkuOTg5MSA4LjAwNjcyIDE5LjgzODIgNy40MTM5MkMxOS43NjEzIDcuMTEyMDMgMTkuNjQzMyA2LjcxOTU3IDE5LjYwMjEgNi42NDU0N0MxOS41ODAyIDYuNjA0MzEgMTkuNTAwNiA2LjY3NTY2IDE5LjA2NDIgNy4xMTQ3N0MxOC43ODE2IDcuNDAwMiAxOC40NDQgNy43MzIyOCAxOC4zMDk1IDcuODUwMjlMMTguMDcwNyA4LjA2NzFMMTguMTExOSA4LjIwNDMyQzE4LjI0MDkgOC42MjY5NyAxOC4yODQ4IDkuMzM3NzggMTguMjEwNyA5Ljc1NDk0QzE3Ljk5MzkgMTAuOTQ4OCAxNy4wODgyIDExLjg0MzUgMTUuODU2IDEyLjA3NjdDMTUuNTg5OCAxMi4xMjYxIDE0Ljk5NyAxMi4xMzcxIDE0Ljc1MjcgMTIuMDkzMkwxNC42MDcyIDEyLjA2ODVMMTQuNjIzNyAxMi4xNTM2QzE0LjYzMTkgMTIuMjAwMiAxNC42NzA0IDEyLjM2NzcgMTQuNzA4OCAxMi41MjY4QzE0Ljc0NDUgMTIuNjg2IDE0Ljc4NTYgMTIuODk3MyAxNC43OTM5IDEyLjk5ODlMMTQuODEzMSAxMy4xODU1TDE1LjQzMzMgMTMuNTc4QzE2LjQ0ODggMTQuMjIwMiAxNi43NzgxIDE0LjQzNDIgMTYuNzc4MSAxNC40NDhDMTYuNzgwOSAxNC40NTYyIDE2LjY4NDggMTQuNTE2NiAxNi41NjY4IDE0LjU4MjRDMTUuOTk1OSAxNC45MDYzIDE1LjM0MjggMTUuMzcwMSAxNC45OTk3IDE1LjY5NjdDMTQuMjI1OCAxNi40MzIyIDEzLjU1NjEgMTcuNjkxOSAxMi42NjQyIDIwLjA4NzhDMTIuNDYzOCAyMC42MzEyIDEyLjA2ODYgMjEuNzQ4MiAxMi4wNDY3IDIxLjgzODhDMTIuMDM1NyAyMS44Nzk5IDEyLjAxOTIgMjEuOTEyOSAxMi4wMDgyIDIxLjkxMjlDMTIgMjEuOTEwMSAxMS45NTA2IDIxLjc4MzkgMTEuODk4NSAyMS42MzAyQzExLjc0MiAyMS4xNDcyIDExLjIzOTggMTkuNzgwNCAxMS4wMTc1IDE5LjIyMzNDMTAuMjI0NCAxNy4yMzkxIDkuNjA5NiAxNi4yMTI2IDguNzk3MjQgMTUuNTE1NUM4LjUxNDU2IDE1LjI3NCA3LjkyNDUgMTQuODY1MSA3LjUzMjA1IDE0LjY0MDFDNy40MTk1MiAxNC41NzQyIDcuMzAxNTEgMTQuNTA1NiA3LjI3NDA3IDE0LjQ4NjRDNy4yMjc0MSAxNC40NTM0IDcuMjY4NTggMTQuNDIwNSA3LjcwNzY5IDE0LjEzMjNDNy45NzM5IDEzLjk1NjcgOC40MTMwMSAxMy42NzY4IDguNjc5MjMgMTMuNTA5M0M4Ljk0NTQ0IDEzLjM0MTkgOS4xNzA0OCAxMy4yMDIgOS4xNzU5NyAxMy4xOTY1QzkuMTgxNDYgMTMuMTkxIDkuMjAzNDIgMTMuMDc1NyA5LjIyMjYzIDEyLjkzODVDOS4yNTgzIDEyLjcwMjUgOS4zNjgwOCAxMi4yMTY3IDkuNDE0NzQgMTIuMTA0MkM5LjQzMTIxIDEyLjA2MDMgOS40MjU3MiAxMi4wNTQ4IDkuMzY1MzQgMTIuMDY4NUM5LjAxNDA1IDEyLjE1NjMgOC4zNzE4NSAxMi4xNDI2IDcuOTU0NjkgMTIuMDM1NkM3LjE3ODAxIDExLjgzNTIgNi40OTczOSAxMS4zMzg1IDYuMTM1MTIgMTAuNzA3M0M1LjczOTkyIDEwLjAxNTcgNS42NTQ4NCA5LjEyMzcxIDUuOTA0NTkgOC4yMzcyNkw1Ljk0ODUgOC4wNzUzM0w1LjU1MzMgNy43MDQ4M0M1LjMzNjQ4IDcuNDk5IDQuOTk2MTcgNy4xNjY5MiA0Ljc5ODU3IDYuOTYxMDhMNC40MzYzIDYuNTkwNThMNC4zNzg2NyA2Ljc0OTc2Wk02LjgzNDk1IDguODg0OTVDNi43NjYzNCA5LjE1NjY1IDYuNzkzNzkgOS41NzY1NSA2LjkwMDgyIDkuODkyMTZDNy4xODA3NiAxMC43MTgyIDguMDM3MDIgMTEuMjI2IDguOTg5MzUgMTEuMTI3MkM5LjM5MDA0IDExLjA4NiA5LjgyMzY2IDEwLjk2MjUgOS43NjYwMyAxMC45MDc2QzkuNzUyMzEgMTAuODk2NiA5LjQyMDIzIDEwLjY3MTYgOS4wMjc3NyAxMC40MDgxQzguMzMzNDMgOS45NDQzIDcuNzA0OTUgOS40OTE0NyA3LjE3NTI3IDkuMDc0MzFDNy4wMzI1NiA4Ljk2MTc5IDYuOTAwODIgOC44NTc1IDYuODg0MzUgOC44NDM3OEM2Ljg2MjQgOC44MjczMSA2Ljg0NTkzIDguODQxMDMgNi44MzQ5NSA4Ljg4NDk1Wk0xNy4wMDA0IDguOTQ4MDdDMTYuNDgxNyA5LjM3MDcxIDE1LjczNTIgOS45MDU4OCAxNC44NjUyIDEwLjQ4NUMxNC4xMTA1IDEwLjk4NzIgMTQuMTQzNCAxMC45Mjk2IDE0LjU1NzggMTEuMDQ0OEMxNC44NDg4IDExLjEyNzIgMTUuNDI3OCAxMS4xNDkxIDE1LjcyNDIgMTEuMDg4N0MxNi4wNjczIDExLjAyMDEgMTYuNDE4NiAxMC44MzA4IDE2LjY3MzggMTAuNTc4M0MxNi44NDY3IDEwLjQwODEgMTYuOTA0NCAxMC4zMjU4IDE3LjAwODYgMTAuMTExN0MxNy4wNzczIDkuOTY5IDE3LjE0ODYgOS43ODIzOCAxNy4xNjc4IDkuNzAwMDVDMTcuMjA5IDkuNTM1MzggMTcuMjExNyA5LjAxOTQyIDE3LjE3MzMgOC44OTg2N0wxNy4xNTE0IDguODI3MzFMMTcuMDAwNCA4Ljk0ODA3Wk0xMS43Nzc3IDEwLjU4OTNDMTEuMjE3OCAxMC43ODk2IDEwLjY0NDMgMTEuNTcxOCAxMC4zNjE2IDEyLjUxODZDMTAuMjkzIDEyLjc1NzQgMTAuMjA3OSAxMy4yMjEyIDEwLjE1MyAxMy42Nzk1TDEwLjEzNjUgMTMuODA1N0w5LjY1MDc2IDE0LjA5OTRDOS4zODQ1NSAxNC4yNjEzIDkuMTQ4NTMgMTQuNDA0IDkuMTI5MzIgMTQuNDE3OEM5LjEwNDYyIDE0LjQzMTUgOS4xNjQ5OSAxNC40OTQ2IDkuMzM1MTUgMTQuNjMxOEM5LjY2MTc0IDE0Ljg5MjYgMTAuMTk0MiAxNS40NDk3IDEwLjQxMzcgMTUuNzU5OEMxMC44ODg1IDE2LjQyOTQgMTEuMzY4OCAxNy4zNTQzIDExLjgxMzQgMTguNDU0OUMxMS45MDY3IDE4LjY4ODEgMTEuOTg5IDE4Ljg5MTIgMTEuOTk3MyAxOC45MDIyQzEyLjAwNTUgMTguOTEzMiAxMi4wOTMzIDE4LjcxNTYgMTIuMTk3NiAxOC40NjMxQzEyLjczNTUgMTcuMTMyIDEzLjIzNzggMTYuMTk2MiAxMy43ODEyIDE1LjUxODNDMTQuMDAzNSAxNS4yNDExIDE0LjM3MTIgMTQuODc2MSAxNC42NzA0IDE0LjYzNzNMMTQuOTE3NCAxNC40Mzk3TDE0LjgyNjggMTQuMzc5M0MxNC43Nzc0IDE0LjM0NjQgMTQuNTQxNCAxNC4yMDY0IDE0LjMwNTQgMTQuMDY2NUwxMy44NzQ1IDEzLjgxMTJMMTMuODYwOCAxMy42OTg3QzEzLjcxNTMgMTIuNTUxNSAxMy41NTA2IDEyLjAzMDEgMTMuMTQ3MiAxMS40MjA4QzEyLjcwODEgMTAuNzYyMiAxMi4xODM5IDEwLjQ0MzggMTEuNzc3NyAxMC41ODkzWiIgZmlsbD0iY3VycmVudENvbG9yIj48L3BhdGg+PC9zdmc+","iconBg":"#111111"};
const X_ICON = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZD0iTTE0LjIzNCAxMC4xNjIgMjIuOTc3IDBoLTIuMDcybC03LjU5MSA4LjgyNEw3LjI1MSAwSC4yNThsOS4xNjggMTMuMzQzTC4yNTggMjRIMi4zM2w4LjAxNi05LjMxOEwxNi43NDkgMjRoNi45OTN6bS0yLjgzNyAzLjI5OS0uOTI5LTEuMzI5TDMuMDc2IDEuNTZoMy4xODJsNS45NjUgOC41MzIuOTI5IDEuMzI5IDcuNzU0IDExLjA5aC0zLjE4MnoiLz48L3N2Zz4=";
const TELEGRAM_ICON = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZD0iTTkuNzggMTguNjUgMTAuMDYgMTQuNDIgMTcuNzMgNy41MUMxOC4wNyA3LjIgMTcuNjYgNy4wNSAxNy4yIDcuMzJMNy43MyAxMy4zIDMuNjQgMTIuMDJDMi43NiAxMS43NyAyLjc1IDExLjE2IDMuODQgMTAuNzJMMTkuNzcgNC41OEMyMC41IDQuMjUgMjEuMiA0Ljc2IDIwLjkyIDUuODhMMTguMjEgMTguNjVDMTguMDIgMTkuNTYgMTcuNDcgMTkuNzggMTYuNzIgMTkuMzZMMTIuNTkgMTYuMzEgMTAuNiAxOC4yNEMxMC4zNyAxOC40NyAxMC4xOCAxOC42NSA5Ljc4IDE4LjY1WiIvPjwvc3ZnPg==";
const COMMUNITY_ICON = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PGNpcmNsZSBjeD0iMTIiIGN5PSI1LjUiIHI9IjMiLz48Y2lyY2xlIGN4PSI0LjUiIGN5PSI4IiByPSIyLjUiLz48Y2lyY2xlIGN4PSIxOS41IiBjeT0iOCIgcj0iMi41Ii8+PHBhdGggZD0iTTcgMjF2LTZhNSA1IDAgMCAxIDEwIDB2Nkg3Wk0xIDE5di00YTMuNSAzLjUgMCAwIDEgNS4zLTMgNi41IDYuNSAwIDAgMC0uOCAzdjRIMVptMTcuNSAwdi00YTYuNSA2LjUgMCAwIDAtLjgtMyAzLjUgMy41IDAgMCAxIDUuMyAzdjRoLTQuNVoiLz48L3N2Zz4=";
const MAX_EXTRA_SOCIAL_LINKS = 8;

// Accept only https URLs without embedded credentials.
function safeUrl(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

function getBuyLink(config) {
  const ca = (config.contract_address || "").trim(), platform = config.buy_platform || "";
  if (!platform) return null;
  let template = null, label = "Buy", icon = null, iconBg = null;
  if (platform.startsWith("custom:")) template = platform.slice("custom:".length);
  else if (BUY && platform === BUY.id) ({ template, label, icon, iconBg } = BUY);
  // Selected platform but no CA yet: its logo as a disabled "coming soon" button.
  if (!ca) return BUY && platform === BUY.id ? { label, href: null, icon, iconBg, disabled: true } : null;
  if (!template || !template.includes("{CA}")) return null;
  const href = safeUrl(template.split("{CA}").join(encodeURIComponent(ca)));
  return href ? { label, href, icon, iconBg } : null;
}

function getChartLink(config) {
  const href = safeUrl(config.dexscreener_url), host = href ? new URL(href).hostname : "";
  const bareHost = host.startsWith("www.") ? host.slice(4) : host;
  const brand = CHART_BRAND && (config.chart_platform === CHART_BRAND.id || (bareHost && bareHost === CHART_BRAND.host)) ? CHART_BRAND : null;
  if (!href) return brand ? { label: brand.label, href: null, icon: brand.icon, iconBg: brand.iconBg, disabled: true } : null;
  return { label: brand ? brand.label : "Chart", href, icon: brand ? brand.icon : null, iconBg: brand ? brand.iconBg : null };
}

function getSocialLinks(config) {
  const base = [
    { label: "Twitter", url: config.twitter_url, icon_url: config.twitter_icon_url, defaultIcon: X_ICON },
    { label: "Community", url: config.community_url, icon_url: config.community_icon_url, defaultIcon: COMMUNITY_ICON },
  ];
  const extra = (Array.isArray(config.social_links) ? config.social_links : []).slice(0, MAX_EXTRA_SOCIAL_LINKS);
  return [...base, ...extra].flatMap(link => {
    const href = safeUrl(link && link.url), label = link && typeof link.label === "string" ? link.label.trim() : "";
    if (!href || !label) return [];
    return [{ label, href, icon: safeUrl(link.icon_url), defaultIcon: link.defaultIcon || null }];
  });
}

// PSX icon button (same bevel as the nav and the sound button). Icon-only links keep their label for screen readers;
// the buy button shows it. No innerHTML anywhere: config text only ever goes through textContent / attributes.
function makeLink(link, cls = "") {
  const a = document.createElement(link.href ? "a" : "span");
  a.className = ("lk " + cls).trim();
  if (link.href) { a.href = link.href; a.target = "_blank"; a.rel = "noopener noreferrer"; }
  else { a.setAttribute("aria-disabled", "true"); a.title = "Coming soon"; a.style.opacity = "0.5"; }
  const text = document.createElement("span"); text.className = "lbl"; text.textContent = link.label;
  const mask = () => {
    if (!link.defaultIcon) { a.classList.add("txt"); return; } // no icon left: show the label
    const s = document.createElement("span"); s.className = "mi"; s.setAttribute("aria-hidden", "true");
    s.style.webkitMask = s.style.mask = 'url("' + link.defaultIcon + '") center / contain no-repeat';
    a.prepend(s);
  };
  if (link.icon) {
    const img = document.createElement("img");
    img.src = link.icon; img.alt = ""; img.width = 24; img.height = 24; img.referrerPolicy = "no-referrer";
    if (link.iconBg) Object.assign(img.style, { background: link.iconBg, borderRadius: "50%", padding: "3px", boxSizing: "border-box" }); // white logo on a dark disc
    img.onerror = () => { img.remove(); mask(); };
    a.append(img);
  } else mask();
  a.append(text);
  if (!link.href) a.title = "Coming soon";
  else if (!cls) a.title = link.label;
  return a;
}

// Contract address: "Coming Soon" until the admin sets one (also when the config fails), then the full CA + copy.
function setCA(ca) {
  const dd = $("ca");
  if (!ca) { dd.textContent = "Coming Soon"; return; }
  const code = document.createElement("code"); code.textContent = ca;
  const b = document.createElement("button"); b.type = "button"; b.className = "ca-copy"; b.textContent = "Copy"; b.setAttribute("aria-label", "Copy contract address");
  b.onclick = async () => {
    try { await navigator.clipboard.writeText(ca); b.textContent = "Copied"; }
    catch { getSelection().selectAllChildren(code); b.textContent = "Ctrl+C"; } // no clipboard access: select it for the visitor
    setTimeout(() => { b.textContent = "Copy"; }, 1600);
  };
  dd.replaceChildren(code, b);
}

setCA("");
loadProjectConfig().then(config => {
  if (config.title) document.title = config.title; // tab title from admin
  const chart = getChartLink(config), buy = getBuyLink(config);
  $("links").replaceChildren(...getSocialLinks(config).map(l => makeLink(l)), ...(chart ? [makeLink(chart)] : []), ...(buy ? [makeLink(buy, "buy")] : []));
  setCA((config.contract_address || "").trim());
}).catch(err => console.error("Error loading project config:", err));
