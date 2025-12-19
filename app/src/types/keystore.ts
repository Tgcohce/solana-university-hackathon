/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/keystore.json`.
 */
export type Keystore = {
  "address": "A3TmryC5ojiCpB6zHmeTTDw4VcSfqYtMKAFrb68mYeyV",
  "metadata": {
    "name": "keystore",
    "version": "0.1.0",
    "spec": "0.1.0"
  },
  "instructions": [
    {
      "name": "addKey",
      "discriminator": [
        251,
        19,
        183,
        109,
        168,
        179,
        18,
        195
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "identity",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  105,
                  100,
                  101,
                  110,
                  116,
                  105,
                  116,
                  121
                ]
              },
              {
                "kind": "account",
                "path": "authority"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "newPubkey",
          "type": {
            "array": [
              "u8",
              33
            ]
          }
        },
        {
          "name": "deviceName",
          "type": "string"
        }
      ]
    },
    {
      "name": "createIdentity",
      "discriminator": [
        12,
        253,
        209,
        41,
        176,
        51,
        195,
        179
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "identity",
          "writable": true
        },
        {
          "name": "vault",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "identity"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "pubkey",
          "type": {
            "array": [
              "u8",
              33
            ]
          }
        },
        {
          "name": "deviceName",
          "type": "string"
        }
      ]
    },
    {
      "name": "execute",
      "discriminator": [
        130,
        221,
        242,
        154,
        13,
        193,
        189,
        29
      ],
      "accounts": [
        {
          "name": "identity",
          "writable": true
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "identity"
              }
            ]
          }
        },
        {
          "name": "recipient",
          "writable": true,
          "optional": true
        },
        {
          "name": "instructions",
          "address": "Sysvar1nstructions1111111111111111111111111"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "action",
          "type": {
            "defined": {
              "name": "action"
            }
          }
        },
        {
          "name": "sigs",
          "type": {
            "vec": {
              "defined": {
                "name": "signatureData"
              }
            }
          }
        },
        {
          "name": "signedData",
          "type": "bytes"
        }
      ]
    },
    {
      "name": "registerCredential",
      "discriminator": [
        1,
        125,
        182,
        19,
        180,
        151,
        48,
        231
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "identity",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  105,
                  100,
                  101,
                  110,
                  116,
                  105,
                  116,
                  121
                ]
              },
              {
                "kind": "account",
                "path": "authority"
              }
            ]
          }
        },
        {
          "name": "credentialRegistry",
          "writable": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "credentialId",
          "type": "bytes"
        },
        {
          "name": "deviceName",
          "type": "string"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "credentialRegistry",
      "discriminator": [
        188,
        150,
        55,
        168,
        231,
        56,
        154,
        136
      ]
    },
    {
      "name": "identity",
      "discriminator": [
        58,
        132,
        5,
        12,
        176,
        164,
        85,
        112
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "thresholdNotMet",
      "msg": "Threshold not met"
    },
    {
      "code": 6001,
      "name": "invalidKeyIndex",
      "msg": "Invalid key index"
    },
    {
      "code": 6002,
      "name": "maxKeysReached",
      "msg": "Max keys reached (limit: 5)"
    },
    {
      "code": 6003,
      "name": "invalidThreshold",
      "msg": "Invalid threshold value"
    },
    {
      "code": 6004,
      "name": "signatureVerificationFailed",
      "msg": "Signature verification failed or duplicate key used"
    },
    {
      "code": 6005,
      "name": "invalidSecp256r1Instruction",
      "msg": "Invalid secp256r1 instruction format"
    },
    {
      "code": 6006,
      "name": "duplicateKey",
      "msg": "Duplicate public key not allowed"
    },
    {
      "code": 6007,
      "name": "invalidPublicKey",
      "msg": "Invalid public key format"
    },
    {
      "code": 6008,
      "name": "invalidArgument",
      "msg": "Invalid argument provided"
    },
    {
      "code": 6009,
      "name": "invalidAccountData",
      "msg": "Invalid account data"
    },
    {
      "code": 6010,
      "name": "insufficientFunds",
      "msg": "Insufficient funds"
    },
    {
      "code": 6011,
      "name": "invalidClientData",
      "msg": "Invalid client data JSON"
    }
  ],
  "types": [
    {
      "name": "action",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "send",
            "fields": [
              {
                "name": "to",
                "type": "pubkey"
              },
              {
                "name": "lamports",
                "type": "u64"
              }
            ]
          },
          {
            "name": "setThreshold",
            "fields": [
              {
                "name": "threshold",
                "type": "u8"
              }
            ]
          }
        ]
      }
    },
    {
      "name": "credentialRegistry",
      "docs": [
        "On-chain registry for WebAuthn credential IDs",
        "This allows users to recover their wallet from any device"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "identity",
            "type": "pubkey"
          },
          {
            "name": "keyIndex",
            "type": "u8"
          },
          {
            "name": "credentialId",
            "type": "bytes"
          },
          {
            "name": "deviceName",
            "type": "string"
          },
          {
            "name": "registeredAt",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "identity",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "vaultBump",
            "type": "u8"
          },
          {
            "name": "threshold",
            "type": "u8"
          },
          {
            "name": "nonce",
            "type": "u64"
          },
          {
            "name": "keys",
            "type": {
              "vec": {
                "defined": {
                  "name": "registeredKey"
                }
              }
            }
          }
        ]
      }
    },
    {
      "name": "registeredKey",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "pubkey",
            "type": {
              "array": [
                "u8",
                33
              ]
            }
          },
          {
            "name": "name",
            "type": "string"
          },
          {
            "name": "addedAt",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "signatureData",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "keyIndex",
            "type": "u8"
          },
          {
            "name": "signature",
            "type": {
              "array": [
                "u8",
                64
              ]
            }
          },
          {
            "name": "recoveryId",
            "type": "u8"
          }
        ]
      }
    }
  ]
};
