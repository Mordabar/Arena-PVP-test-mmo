/* =============================================================================
 * data/rigCalibration.js — GENERADO. No editar a mano.
 *
 *   node tools/bake-rig-calibration.js --rm RUTA_AL_UAL2_Standard_RM.glb
 *
 * Pose de reposo medida de los dos esqueletos y metadatos de los 43 clips.
 * Las velocidades salen del gemelo con root motion horneado, que NO viaja en el
 * repo por tamaño: aquí sobreviven como número.
 * ========================================================================== */
Arena.define('data/rigCalibration', [], function (Arena) {
  'use strict';
  var C = {
 "meta": {
  "generado": "tools/bake-rig-calibration.js",
  "fuente": "assets/animations/ual2-standard.glb",
  "destino": "assets/models/dark-elf-base-rigged-50k.glb",
  "rmMedido": true,
  "legRatio": 0.96907,
  "targetHipsY": 0.955,
  "sourcePelvisY": 0.9167
 },
 "target": {
  "Hips": {
   "worldPos": [
    0,
    0.955,
    0
   ],
   "worldQuat": [
    0,
    0,
    0,
    1
   ],
   "localPos": [
    0,
    0.955,
    0
   ],
   "localQuat": [
    0,
    0,
    0,
    1
   ],
   "parent": "Armature"
  },
  "Spine": {
   "worldPos": [
    0,
    1.105,
    0
   ],
   "worldQuat": [
    0,
    0,
    0,
    1
   ],
   "localPos": [
    0,
    0.15,
    0
   ],
   "localQuat": [
    0,
    0,
    0,
    1
   ],
   "parent": "Hips"
  },
  "Chest": {
   "worldPos": [
    0,
    1.305,
    0
   ],
   "worldQuat": [
    0,
    0,
    0,
    1
   ],
   "localPos": [
    0,
    0.2,
    0
   ],
   "localQuat": [
    0,
    0,
    0,
    1
   ],
   "parent": "Spine"
  },
  "Neck": {
   "worldPos": [
    0,
    1.505,
    0
   ],
   "worldQuat": [
    0,
    0,
    0,
    1
   ],
   "localPos": [
    0,
    0.2,
    0
   ],
   "localQuat": [
    0,
    0,
    0,
    1
   ],
   "parent": "Chest"
  },
  "Head": {
   "worldPos": [
    0,
    1.655,
    0.015
   ],
   "worldQuat": [
    0,
    0,
    0,
    1
   ],
   "localPos": [
    0,
    0.15,
    0.015
   ],
   "localQuat": [
    0,
    0,
    0,
    1
   ],
   "parent": "Neck"
  },
  "LeftUpperArm": {
   "worldPos": [
    -0.255,
    1.425,
    0.005
   ],
   "worldQuat": [
    0,
    0,
    0,
    1
   ],
   "localPos": [
    -0.255,
    0.12,
    0.005
   ],
   "localQuat": [
    0,
    0,
    0,
    1
   ],
   "parent": "Chest"
  },
  "LeftLowerArm": {
   "worldPos": [
    -0.34,
    1.165,
    0.025
   ],
   "worldQuat": [
    0,
    0,
    0,
    1
   ],
   "localPos": [
    -0.085,
    -0.26,
    0.02
   ],
   "localQuat": [
    0,
    0,
    0,
    1
   ],
   "parent": "LeftUpperArm"
  },
  "LeftHand": {
   "worldPos": [
    -0.398,
    0.915,
    0.055
   ],
   "worldQuat": [
    0,
    0,
    0,
    1
   ],
   "localPos": [
    -0.058,
    -0.25,
    0.03
   ],
   "localQuat": [
    0,
    0,
    0,
    1
   ],
   "parent": "LeftLowerArm"
  },
  "RightUpperArm": {
   "worldPos": [
    0.255,
    1.425,
    0.005
   ],
   "worldQuat": [
    0,
    0,
    0,
    1
   ],
   "localPos": [
    0.255,
    0.12,
    0.005
   ],
   "localQuat": [
    0,
    0,
    0,
    1
   ],
   "parent": "Chest"
  },
  "RightLowerArm": {
   "worldPos": [
    0.34,
    1.165,
    0.025
   ],
   "worldQuat": [
    0,
    0,
    0,
    1
   ],
   "localPos": [
    0.085,
    -0.26,
    0.02
   ],
   "localQuat": [
    0,
    0,
    0,
    1
   ],
   "parent": "RightUpperArm"
  },
  "RightHand": {
   "worldPos": [
    0.398,
    0.915,
    0.055
   ],
   "worldQuat": [
    0,
    0,
    0,
    1
   ],
   "localPos": [
    0.058,
    -0.25,
    0.03
   ],
   "localQuat": [
    0,
    0,
    0,
    1
   ],
   "parent": "RightLowerArm"
  },
  "LeftUpperLeg": {
   "worldPos": [
    -0.105,
    0.905,
    0
   ],
   "worldQuat": [
    0,
    0,
    0,
    1
   ],
   "localPos": [
    -0.105,
    -0.05,
    0
   ],
   "localQuat": [
    0,
    0,
    0,
    1
   ],
   "parent": "Hips"
  },
  "LeftLowerLeg": {
   "worldPos": [
    -0.105,
    0.505,
    0.008
   ],
   "worldQuat": [
    0,
    0,
    0,
    1
   ],
   "localPos": [
    0,
    -0.4,
    0.008
   ],
   "localQuat": [
    0,
    0,
    0,
    1
   ],
   "parent": "LeftUpperLeg"
  },
  "LeftFoot": {
   "worldPos": [
    -0.105,
    0.105,
    0.065
   ],
   "worldQuat": [
    0,
    0,
    0,
    1
   ],
   "localPos": [
    0,
    -0.4,
    0.057
   ],
   "localQuat": [
    0,
    0,
    0,
    1
   ],
   "parent": "LeftLowerLeg"
  },
  "RightUpperLeg": {
   "worldPos": [
    0.105,
    0.905,
    0
   ],
   "worldQuat": [
    0,
    0,
    0,
    1
   ],
   "localPos": [
    0.105,
    -0.05,
    0
   ],
   "localQuat": [
    0,
    0,
    0,
    1
   ],
   "parent": "Hips"
  },
  "RightLowerLeg": {
   "worldPos": [
    0.105,
    0.505,
    0.008
   ],
   "worldQuat": [
    0,
    0,
    0,
    1
   ],
   "localPos": [
    0,
    -0.4,
    0.008
   ],
   "localQuat": [
    0,
    0,
    0,
    1
   ],
   "parent": "RightUpperLeg"
  },
  "RightFoot": {
   "worldPos": [
    0.105,
    0.105,
    0.065
   ],
   "worldQuat": [
    0,
    0,
    0,
    1
   ],
   "localPos": [
    0,
    -0.4,
    0.057
   ],
   "localQuat": [
    0,
    0,
    0,
    1
   ],
   "parent": "RightLowerLeg"
  }
 },
 "source": {
  "pelvis": {
   "worldPos": [
    0,
    0.9167,
    -0.0501
   ],
   "worldQuat": [
    0.12584,
    0,
    0,
    0.99205
   ],
   "localPos": [
    0,
    0.0501,
    0.9167
   ],
   "localQuat": [
    0.79047,
    0,
    0,
    0.6125
   ],
   "parent": "root"
  },
  "spine_01": {
   "worldPos": [
    0,
    1.0505,
    -0.0156
   ],
   "worldQuat": [
    0.06139,
    0,
    0,
    0.99811
   ],
   "localPos": [
    0,
    0.13818,
    0
   ],
   "localQuat": [
    -0.0647,
    0,
    0,
    0.9979
   ],
   "parent": "pelvis"
  },
  "spine_02": {
   "worldPos": [
    0,
    1.1736,
    -0.0004
   ],
   "worldQuat": [
    -0.01593,
    0,
    0,
    0.99987
   ],
   "localPos": [
    0,
    0.12403,
    0
   ],
   "localQuat": [
    -0.07728,
    0,
    0,
    0.99701
   ],
   "parent": "spine_01"
  },
  "spine_03": {
   "worldPos": [
    0,
    1.3148,
    -0.0049
   ],
   "worldQuat": [
    -0.0162,
    0,
    0,
    0.99987
   ],
   "localPos": [
    0,
    0.14127,
    0
   ],
   "localQuat": [
    -0.00027,
    0,
    0,
    1
   ],
   "parent": "spine_02"
  },
  "neck_01": {
   "worldPos": [
    0,
    1.4876,
    -0.0105
   ],
   "worldQuat": [
    0.09487,
    0,
    0,
    0.99549
   ],
   "localPos": [
    0,
    0.17289,
    0
   ],
   "localQuat": [
    0.11099,
    0,
    0,
    0.99382
   ],
   "parent": "spine_03"
  },
  "Head": {
   "worldPos": [
    0,
    1.5687,
    0.0051
   ],
   "worldQuat": [
    0.01626,
    0,
    0,
    0.99987
   ],
   "localPos": [
    0,
    0.08259,
    0
   ],
   "localQuat": [
    -0.07867,
    0,
    0,
    0.9969
   ],
   "parent": "neck_01"
  },
  "clavicle_l": {
   "worldPos": [
    0.0188,
    1.4579,
    0.0714
   ],
   "worldQuat": [
    -0.61404,
    -0.35084,
    -0.35108,
    0.61369
   ],
   "localPos": [
    0.0188,
    0.14055,
    0.0809
   ],
   "localQuat": [
    -0.60402,
    -0.3451,
    -0.35672,
    0.62355
   ],
   "parent": "spine_03"
  },
  "upperarm_l": {
   "worldPos": [
    0.1919,
    1.4408,
    -0.0654
   ],
   "worldQuat": [
    -0.00604,
    0.00607,
    -0.70708,
    0.70708
   ],
   "localPos": [
    -0.03007,
    0.21858,
    -0.01697
   ],
   "localQuat": [
    0.18027,
    0.68385,
    -0.17984,
    0.68375
   ],
   "parent": "clavicle_l"
  },
  "lowerarm_l": {
   "worldPos": [
    0.4663,
    1.4408,
    -0.0701
   ],
   "worldQuat": [
    0.0061,
    -0.0061,
    -0.70708,
    0.70708
   ],
   "localPos": [
    0,
    0.27444,
    0
   ],
   "localQuat": [
    0.01718,
    -0.00002,
    0,
    0.99985
   ],
   "parent": "upperarm_l"
  },
  "hand_l": {
   "worldPos": [
    0.7389,
    1.4408,
    -0.0654
   ],
   "worldQuat": [
    0,
    0,
    -0.70711,
    0.70711
   ],
   "localPos": [
    0,
    0.27264,
    0
   ],
   "localQuat": [
    -0.00862,
    0,
    0,
    0.99996
   ],
   "parent": "lowerarm_l"
  },
  "clavicle_r": {
   "worldPos": [
    -0.0188,
    1.4579,
    0.0714
   ],
   "worldQuat": [
    -0.61404,
    0.35084,
    0.35108,
    0.61369
   ],
   "localPos": [
    -0.0188,
    0.14055,
    0.0809
   ],
   "localQuat": [
    -0.60402,
    0.3451,
    0.35672,
    0.62355
   ],
   "parent": "spine_03"
  },
  "upperarm_r": {
   "worldPos": [
    -0.1919,
    1.4408,
    -0.0654
   ],
   "worldQuat": [
    -0.00604,
    -0.00607,
    0.70708,
    0.70708
   ],
   "localPos": [
    0.03007,
    0.21858,
    -0.01697
   ],
   "localQuat": [
    0.18027,
    -0.68385,
    0.17984,
    0.68375
   ],
   "parent": "clavicle_r"
  },
  "lowerarm_r": {
   "worldPos": [
    -0.4663,
    1.4408,
    -0.0701
   ],
   "worldQuat": [
    0.0061,
    0.0061,
    0.70708,
    0.70708
   ],
   "localPos": [
    0,
    0.27444,
    0
   ],
   "localQuat": [
    0.01718,
    0.00002,
    0,
    0.99985
   ],
   "parent": "upperarm_r"
  },
  "hand_r": {
   "worldPos": [
    -0.7389,
    1.4408,
    -0.0654
   ],
   "worldQuat": [
    0,
    0,
    0.70711,
    0.70711
   ],
   "localPos": [
    0,
    0.27264,
    0
   ],
   "localQuat": [
    -0.00862,
    0,
    0,
    0.99996
   ],
   "parent": "lowerarm_r"
  },
  "thigh_l": {
   "worldPos": [
    0.089,
    0.9321,
    0.0014
   ],
   "worldQuat": [
    0.99999,
    0,
    0,
    -0.0035
   ],
   "localPos": [
    0.089,
    0.02777,
    0.04602
   ],
   "localQuat": [
    0.99248,
    0,
    0,
    0.12237
   ],
   "parent": "pelvis"
  },
  "calf_l": {
   "worldPos": [
    0.089,
    0.5318,
    -0.0014
   ],
   "worldQuat": [
    0.9992,
    0.00001,
    -0.00013,
    -0.04008
   ],
   "localPos": [
    0,
    0.40031,
    0
   ],
   "localQuat": [
    0.03659,
    -0.00013,
    0,
    0.99933
   ],
   "parent": "thigh_l"
  },
  "foot_l": {
   "worldPos": [
    0.089,
    0.1037,
    -0.0358
   ],
   "worldQuat": [
    0.8691,
    -0.00026,
    -0.00045,
    0.49464
   ],
   "localPos": [
    0,
    0.42948,
    0
   ],
   "localQuat": [
    -0.52907,
    -0.00033,
    0.00034,
    0.84858
   ],
   "parent": "calf_l"
  },
  "ball_l": {
   "worldPos": [
    0.089,
    0.0152,
    0.1132
   ],
   "worldQuat": [
    0,
    0.70711,
    0.70711,
    0
   ],
   "localPos": [
    0,
    0.1733,
    0
   ],
   "localQuat": [
    0.00014,
    -0.96431,
    0.26479,
    0.0005
   ],
   "parent": "foot_l"
  },
  "thigh_r": {
   "worldPos": [
    -0.089,
    0.9321,
    0.0014
   ],
   "worldQuat": [
    0.99999,
    0,
    0,
    -0.0035
   ],
   "localPos": [
    -0.089,
    0.02777,
    0.04602
   ],
   "localQuat": [
    0.99248,
    0,
    0,
    0.12237
   ],
   "parent": "pelvis"
  },
  "calf_r": {
   "worldPos": [
    -0.089,
    0.5318,
    -0.0014
   ],
   "worldQuat": [
    0.9992,
    0.00001,
    -0.00013,
    -0.04008
   ],
   "localPos": [
    0,
    0.40031,
    0
   ],
   "localQuat": [
    0.03659,
    -0.00013,
    0,
    0.99933
   ],
   "parent": "thigh_r"
  },
  "foot_r": {
   "worldPos": [
    -0.089,
    0.1037,
    -0.0358
   ],
   "worldQuat": [
    0.8691,
    -0.00026,
    -0.00045,
    0.49464
   ],
   "localPos": [
    0,
    0.42948,
    0
   ],
   "localQuat": [
    -0.52907,
    -0.00033,
    0.00034,
    0.84858
   ],
   "parent": "calf_r"
  },
  "ball_r": {
   "worldPos": [
    -0.089,
    0.0152,
    0.1132
   ],
   "worldQuat": [
    0,
    0.70711,
    0.70711,
    0
   ],
   "localPos": [
    0,
    0.1733,
    0
   ],
   "localQuat": [
    0.00014,
    -0.96431,
    0.26479,
    0.0005
   ],
   "parent": "foot_r"
  }
 },
 "sourceParent": {
  "pelvis": "root",
  "spine_01": "pelvis",
  "spine_02": "spine_01",
  "spine_03": "spine_02",
  "neck_01": "spine_03",
  "Head": "neck_01",
  "clavicle_l": "spine_03",
  "upperarm_l": "clavicle_l",
  "lowerarm_l": "upperarm_l",
  "hand_l": "lowerarm_l",
  "clavicle_r": "spine_03",
  "upperarm_r": "clavicle_r",
  "lowerarm_r": "upperarm_r",
  "hand_r": "lowerarm_r",
  "thigh_l": "pelvis",
  "calf_l": "thigh_l",
  "foot_l": "calf_l",
  "ball_l": "foot_l",
  "thigh_r": "pelvis",
  "calf_r": "thigh_r",
  "foot_r": "calf_r",
  "ball_r": "foot_r"
 },
 "clips": {
  "A_TPose": {
   "duration": 2.5,
   "keys": 76,
   "keyStep": 0.03333,
   "rootDistance": 0,
   "rootSpeed": 0
  },
  "Chest_Open": {
   "duration": 1.36667,
   "keys": 42,
   "keyStep": 0.03333,
   "rootDistance": 0,
   "rootSpeed": 0
  },
  "ClimbUp_1m": {
   "duration": 0.66667,
   "keys": 21,
   "keyStep": 0.03333,
   "rootDistance": 1.95198,
   "rootSpeed": 2.92798
  },
  "Consume": {
   "duration": 1.33333,
   "keys": 41,
   "keyStep": 0.03333,
   "rootDistance": 0,
   "rootSpeed": 0
  },
  "Farm_Harvest": {
   "duration": 2.5,
   "keys": 76,
   "keyStep": 0.03333,
   "rootDistance": 0,
   "rootSpeed": 0
  },
  "Farm_PlantSeed": {
   "duration": 2.76667,
   "keys": 84,
   "keyStep": 0.03333,
   "rootDistance": 0,
   "rootSpeed": 0
  },
  "Farm_Watering": {
   "duration": 3.8,
   "keys": 115,
   "keyStep": 0.03333,
   "rootDistance": 0,
   "rootSpeed": 0
  },
  "Hit_Knockback": {
   "duration": 0.83333,
   "keys": 26,
   "keyStep": 0.03333,
   "rootDistance": 3,
   "rootSpeed": 3.6
  },
  "Idle_FoldArms_Loop": {
   "duration": 2.5,
   "keys": 76,
   "keyStep": 0.03333,
   "rootDistance": 0,
   "rootSpeed": 0
  },
  "Idle_Lantern_Loop": {
   "duration": 2.5,
   "keys": 76,
   "keyStep": 0.03333,
   "rootDistance": 0,
   "rootSpeed": 0
  },
  "Idle_No_Loop": {
   "duration": 2.5,
   "keys": 76,
   "keyStep": 0.03333,
   "rootDistance": 0,
   "rootSpeed": 0
  },
  "Idle_Rail_Call": {
   "duration": 2.5,
   "keys": 76,
   "keyStep": 0.03333,
   "rootDistance": 0,
   "rootSpeed": 0
  },
  "Idle_Rail_Loop": {
   "duration": 2.5,
   "keys": 76,
   "keyStep": 0.03333,
   "rootDistance": 0,
   "rootSpeed": 0
  },
  "Idle_Shield_Break": {
   "duration": 1.06667,
   "keys": 33,
   "keyStep": 0.03333,
   "rootDistance": 0,
   "rootSpeed": 0
  },
  "Idle_Shield_Loop": {
   "duration": 2.5,
   "keys": 76,
   "keyStep": 0.03333,
   "rootDistance": 0,
   "rootSpeed": 0
  },
  "Idle_TalkingPhone_Loop": {
   "duration": 2.93333,
   "keys": 89,
   "keyStep": 0.03333,
   "rootDistance": 0,
   "rootSpeed": 0
  },
  "LayToIdle": {
   "duration": 1.53333,
   "keys": 47,
   "keyStep": 0.03333,
   "rootDistance": 0,
   "rootSpeed": 0
  },
  "Melee_Hook": {
   "duration": 0.46667,
   "keys": 15,
   "keyStep": 0.03333,
   "rootDistance": 0.35468,
   "rootSpeed": 0.76002
  },
  "Melee_Hook_Rec": {
   "duration": 0.6,
   "keys": 19,
   "keyStep": 0.03333,
   "rootDistance": 0,
   "rootSpeed": 0
  },
  "NinjaJump_Idle_Loop": {
   "duration": 2,
   "keys": 61,
   "keyStep": 0.03333,
   "rootDistance": 0,
   "rootSpeed": 0
  },
  "NinjaJump_Land": {
   "duration": 1.26667,
   "keys": 39,
   "keyStep": 0.03333,
   "rootDistance": 0,
   "rootSpeed": 0
  },
  "NinjaJump_Start": {
   "duration": 0.96667,
   "keys": 30,
   "keyStep": 0.03333,
   "rootDistance": 0,
   "rootSpeed": 0
  },
  "OverhandThrow": {
   "duration": 1.33333,
   "keys": 41,
   "keyStep": 0.03333,
   "rootDistance": 0,
   "rootSpeed": 0
  },
  "Shield_Dash": {
   "duration": 1.1,
   "keys": 34,
   "keyStep": 0.03333,
   "rootDistance": 1,
   "rootSpeed": 0.90909
  },
  "Shield_OneShot": {
   "duration": 0.83333,
   "keys": 26,
   "keyStep": 0.03333,
   "rootDistance": 0,
   "rootSpeed": 0
  },
  "Slide_Exit": {
   "duration": 0.5,
   "keys": 16,
   "keyStep": 0.03333,
   "rootDistance": 2,
   "rootSpeed": 4
  },
  "Slide_Loop": {
   "duration": 2,
   "keys": 61,
   "keyStep": 0.03333,
   "rootDistance": 9,
   "rootSpeed": 4.5
  },
  "Slide_Start": {
   "duration": 0.83333,
   "keys": 26,
   "keyStep": 0.03333,
   "rootDistance": 4,
   "rootSpeed": 4.8
  },
  "Sword_Block": {
   "duration": 1.23333,
   "keys": 38,
   "keyStep": 0.03333,
   "rootDistance": 0,
   "rootSpeed": 0
  },
  "Sword_Dash": {
   "duration": 1.56667,
   "keys": 48,
   "keyStep": 0.03333,
   "rootDistance": 3.69224,
   "rootSpeed": 2.35675
  },
  "Sword_Heavy_Combo": {
   "duration": 4.33333,
   "keys": 131,
   "keyStep": 0.03333,
   "rootDistance": 5.32429,
   "rootSpeed": 1.22868
  },
  "Sword_Regular_A": {
   "duration": 0.43333,
   "keys": 14,
   "keyStep": 0.03333,
   "rootDistance": 0.82452,
   "rootSpeed": 1.90275
  },
  "Sword_Regular_A_Rec": {
   "duration": 0.96667,
   "keys": 30,
   "keyStep": 0.03333,
   "rootDistance": 0.3088,
   "rootSpeed": 0.31945
  },
  "Sword_Regular_B": {
   "duration": 0.53333,
   "keys": 17,
   "keyStep": 0.03333,
   "rootDistance": 0.05258,
   "rootSpeed": 0.0986
  },
  "Sword_Regular_B_Rec": {
   "duration": 1.03333,
   "keys": 32,
   "keyStep": 0.03333,
   "rootDistance": 0.36979,
   "rootSpeed": 0.35786
  },
  "Sword_Regular_C": {
   "duration": 2,
   "keys": 61,
   "keyStep": 0.03333,
   "rootDistance": 1.55629,
   "rootSpeed": 0.77814
  },
  "Sword_Regular_Combo": {
   "duration": 3,
   "keys": 91,
   "keyStep": 0.03333,
   "rootDistance": 2.34253,
   "rootSpeed": 0.78084
  },
  "TreeChopping_Loop": {
   "duration": 0.96667,
   "keys": 30,
   "keyStep": 0.03333,
   "rootDistance": 0,
   "rootSpeed": 0
  },
  "Walk_Carry_Loop": {
   "duration": 2,
   "keys": 61,
   "keyStep": 0.03333,
   "rootDistance": 1.3,
   "rootSpeed": 0.65
  },
  "Yes": {
   "duration": 2.5,
   "keys": 76,
   "keyStep": 0.03333,
   "rootDistance": 0,
   "rootSpeed": 0
  },
  "Zombie_Idle_Loop": {
   "duration": 1.33333,
   "keys": 41,
   "keyStep": 0.03333,
   "rootDistance": 0,
   "rootSpeed": 0
  },
  "Zombie_Scratch": {
   "duration": 1.8,
   "keys": 55,
   "keyStep": 0.03333,
   "rootDistance": 0,
   "rootSpeed": 0
  },
  "Zombie_Walk_Fwd_Loop": {
   "duration": 1.33333,
   "keys": 41,
   "keyStep": 0.03333,
   "rootDistance": 1.4,
   "rootSpeed": 1.05
  }
 }
};
  Arena.Data.RigCalibration = C;
  return C;
});
