"""Joint maps for the player rigs (tools/rig.py), in sprite texels of the
idle art (boy 96 px tall, girl 98). Measured off zoomed pixel dumps of each
view. erase boxes: (x0, y0, x1, y1[, 'skin']) - the original arms, painted out
('skin' = only skin / gold-bangle pixels inside the box)."""
from rig import shade

# the boy's limb palette, read off the art (hoodie, skin, denim, sneakers)
BOY_PAL = dict(sleeve=[92, 92, 100], torso=[66, 66, 72], skin=[253, 218, 191], pants=[72, 90, 112],
               shoe=[128, 50, 64], sole=[238, 239, 238])
# the girl: bare arms with gold bangles, leg-warmers, red sandals (toes show)
GIRL_PAL = dict(sleeve=[252, 209, 183], torso=[51, 50, 49], skin=[252, 209, 183], sock=[229, 202, 197],
                gold=[247, 180, 68], shoe=[214, 66, 80], sole=[58, 38, 37], toe=[252, 209, 183])

boy_limbs = dict(
    thigh=5, shin=4, leg_w=8, shoe_len=16, shoe_h=7, heel=5, shoe_w=12,
    upper=7, fore=6, arm_w=7, hand_r=3,
    thigh_bands=lambda p: [(0, 1, p['pants'])],
    shin_bands=lambda p: [(0, 1, p['pants'])],
    upper_bands=lambda p: [(0, 1, p['sleeve'])],
    fore_bands=lambda p: [(0, 0.8, p['sleeve']), (0.8, 1, shade(p['sleeve'], 0.75))],
    palette=BOY_PAL,
)
girl_limbs = dict(
    thigh=3, shin=7, leg_w=6, shoe_len=12, shoe_h=8, heel=4, shoe_w=9,
    upper=7, fore=6, arm_w=5, hand_r=2.5,
    thigh_bands=lambda p: [(0, 1, p['skin'])],
    shin_bands=lambda p: [(0, 0.22, p['skin']), (0.22, 1, p['sock'])],
    upper_bands=lambda p: [(0, 1, p['skin'])],
    fore_bands=lambda p: [(0, 0.55, p['skin']), (0.55, 0.72, p['gold']), (0.72, 1, p['skin'])],
    palette=GIRL_PAL,
)

CONFIGS = {
    # ---------------------------------------------------------------- boy
    'boy_left': dict(view='left', fwd=-1, cut=79, torso=(16, 52, 50, 79),
                     erase=[(24, 57, 41, 78)],
                     hip_pivot=(33, 79), hip_near=(31, 79), hip_far=(35, 78),
                     sh_near=(33, 61), sh_far=(37, 60), **boy_limbs),
    'boy_right': dict(view='right', fwd=1, cut=77, torso=(14, 52, 44, 77),
                      erase=[(21, 58, 38, 76)],
                      hip_pivot=(30, 77), hip_near=(31, 77), hip_far=(27, 76),
                      sh_near=(29, 60), sh_far=(25, 59), **boy_limbs),
    'boy_down': dict(view='down', cut=80, torso=(15, 54, 47, 80),
                     erase=[(4, 57, 17, 76), (44, 57, 58, 76)],
                     hip_pivot=(31, 80), hip_l=(22, 79), hip_r=(40, 79),
                     sh_l=(15, 60), sh_r=(47, 60), palette_extra=dict(sleeve=[78, 78, 86]), **{**boy_limbs, 'leg_w': 10, 'arm_w': 7}),
    'boy_up': dict(view='up', cut=80, torso=(16, 52, 48, 80),
                   erase=[(5, 57, 18, 76), (47, 57, 60, 76)],
                   hip_pivot=(32, 80), hip_l=(23, 79), hip_r=(41, 79),
                   sh_l=(16, 60), sh_r=(49, 60), palette_extra=dict(sleeve=[76, 76, 84]), **{**boy_limbs, 'leg_w': 10, 'arm_w': 7}),
    # --------------------------------------------------------------- girl
    'girl_left': dict(view='left', fwd=-1, cut=79, torso=(18, 54, 36, 79),
                      erase=[(14, 52, 34, 70, 'skin')],
                      hip_pivot=(26, 78), hip_near=(25, 78), hip_far=(28, 78),
                      sh_near=(27, 56), sh_far=(31, 55), **girl_limbs),
    'girl_right': dict(view='right', fwd=1, cut=79, torso=(22, 54, 42, 79),
                       erase=[(22, 58, 44, 74, 'skin')],
                       hip_pivot=(29, 78), hip_near=(30, 78), hip_far=(27, 78),
                       sh_near=(31, 57), sh_far=(27, 56), **girl_limbs),
    'girl_down': dict(view='down', cut=79, torso=(22, 52, 52, 79),
                      erase=[(19, 56, 29, 80, 'skin'), (43, 56, 54, 80, 'skin')],
                      hip_pivot=(37, 78), hip_l=(30, 78), hip_r=(45, 78),
                      sh_l=(27, 58), sh_r=(47, 58), **{**girl_limbs, 'shoe_w': 10}),
    'girl_up': dict(view='up', cut=79, torso=(14, 56, 48, 79),
                    erase=[(10, 62, 21, 76, 'skin'), (38, 62, 50, 76, 'skin')],
                    hip_pivot=(30, 78), hip_l=(23, 78), hip_r=(37, 78),
                    sh_l=(19, 61), sh_r=(44, 61), **{**girl_limbs, 'shoe_w': 10}),
}
