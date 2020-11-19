export const payloadBTC = '{"payId":"test$example.com","payIdAddress":{"paymentNetwork":"BTC","addressDetailsType":"CryptoAddressDetails","addressDetails":{"address":"mhjPjyyFgdMQwyhf2CnzEqfLS3LdAqkvkF"}}}';
export const payloadETH = '{"payId":"test$example.com","payIdAddress":{"paymentNetwork":"ETH","addressDetailsType":"CryptoAddressDetails","addressDetails":{"address":"0x6c42f5bafcccdd517750d8c8bdcd9918fd1364ee"}}}';
export const payloadXRP = '{"payId":"test$example.com","payIdAddress":{"paymentNetwork":"XRP","addressDetailsType":"CryptoAddressDetails","addressDetails":{"address":"rGpbChk5UvgMSZFYmJzQcbh7DShEBbjcng"}}}';

  // Note that these are different than this lib b/c the PayId.org utils order the jwk differently, causing the sig to be different
export const payIdOrgUtils = {
  bitcoreHD: {
    BTC: {
      payload: payloadBTC,
      signatures: [
        {
          protected: 'eyJuYW1lIjoiaWRlbnRpdHlLZXkiLCJhbGciOiJFUzI1NksiLCJ0eXAiOiJKT1NFK0pTT04iLCJiNjQiOmZhbHNlLCJjcml0IjpbImI2NCIsIm5hbWUiXSwiandrIjp7ImNydiI6InNlY3AyNTZrMSIsIngiOiJXenlFaTNaekZheVdTeDBiSGFLeHYtSlhhekZNdkdtRHhCMC00eUx2bjY4IiwieSI6ImJuaHZXYmtwdmprdmFYWFFMUU1fZHVGN3lSSkZENFZZakpteW5KTENoOXMiLCJrdHkiOiJFQyIsImtpZCI6Ims3VXpTWnBnUU1BNkM3SHVnTzhkb3BTRFptcjFhbVltbUxLaTdOb1IxVW8iLCJ1c2UiOiJzaWcifX0',
          signature: 'AIhKI67NipOxfk_x548sLowIG5gw8Aq-oINJbB3WNbQMh5ePXVPgiIjQYW1Z0iJ8ceY7h5LjoytdD5yZ8TwJXQ'
        }
      ]
    }
  },
  bitcore: {
    BTC: {
      payload: payloadBTC,
      signatures: [
        {
          protected: 'eyJuYW1lIjoiaWRlbnRpdHlLZXkiLCJhbGciOiJFUzI1NksiLCJ0eXAiOiJKT1NFK0pTT04iLCJiNjQiOmZhbHNlLCJjcml0IjpbImI2NCIsIm5hbWUiXSwiandrIjp7ImNydiI6InNlY3AyNTZrMSIsIngiOiJKZ0RuaEZCRGtiTGwyUTJXYWFyMHd2ZUJoeUQ3Sl9GWTloRXRLdGV3WXRBIiwieSI6InBGQ3loWmZFc0JQeDVMNzh5Vjg4S3hnTWlwYV83UmR5aXJWV3k4YzFuSG8iLCJrdHkiOiJFQyIsImtpZCI6Ilg0bkg3azRSRmQ5SUNqN25leHl2bm8zMFNOOWdUcVBBWUdFTkt2THJHWlkiLCJ1c2UiOiJzaWcifX0',
          signature: 'RLsN5pd-Vj8m1ybqzwL9Vvm14mV1Galrq6_G8IF1x8X7JSnbTiWrau2YoBk9_v6xiMJDD6fo9kqbquLm8Hmtaw'
        }
      ]
    }
  },
  secp256k1: {
    BTC: {
      payload: payloadBTC,
      signatures: [
        {
          protected: 'eyJuYW1lIjoiaWRlbnRpdHlLZXkiLCJhbGciOiJFUzI1NksiLCJ0eXAiOiJKT1NFK0pTT04iLCJiNjQiOmZhbHNlLCJjcml0IjpbImI2NCIsIm5hbWUiXSwiandrIjp7ImNydiI6InNlY3AyNTZrMSIsIngiOiJ6R1lpTk1jQ2tvOG1henVibGRZNHhqOVc5T3JEaGpJakZiOEYtMlhjT2RBIiwieSI6ImI0SDU4STBjcnlQUnoxT0ZhdVBzTU9STTJ0cFQxcXNiVy1YRUpfZ3pGMDAiLCJrdHkiOiJFQyIsImtpZCI6Ilp4YWhCcUpjQU54S0RTd2xMY2RoRnYwbDVVWGpnazlOWEQ1bDZZMkJrZmcifX0',
          signature: 'q43YPN75Lt4Li9DKdoE5UkANA6NE-D1H9nUaHw-i08kNY4caUq_63WnM46VbcNLjZkYXdZltdMf4tmP1hRAYtg',

        }
      ]
    },
    ETH: {
      payload: payloadETH,
      signatures: [
        {
          protected: 'eyJuYW1lIjoiaWRlbnRpdHlLZXkiLCJhbGciOiJFUzI1NksiLCJ0eXAiOiJKT1NFK0pTT04iLCJiNjQiOmZhbHNlLCJjcml0IjpbImI2NCIsIm5hbWUiXSwiandrIjp7ImNydiI6InNlY3AyNTZrMSIsIngiOiJ6R1lpTk1jQ2tvOG1henVibGRZNHhqOVc5T3JEaGpJakZiOEYtMlhjT2RBIiwieSI6ImI0SDU4STBjcnlQUnoxT0ZhdVBzTU9STTJ0cFQxcXNiVy1YRUpfZ3pGMDAiLCJrdHkiOiJFQyIsImtpZCI6Ilp4YWhCcUpjQU54S0RTd2xMY2RoRnYwbDVVWGpnazlOWEQ1bDZZMkJrZmcifX0',
          signature: 'Xa3Tex57l7TIw7aaYLOAsjszemY3cNc2HAUuB9ng9ps9K32Pg2_C7NNMadPVPBoBqbHS_LHuM_QLMxfFmtFRYA'
        }
      ]
    },
    XRP: {
      payload: payloadXRP,
      signatures: [
        {
          protected: 'eyJuYW1lIjoiaWRlbnRpdHlLZXkiLCJhbGciOiJFUzI1NksiLCJ0eXAiOiJKT1NFK0pTT04iLCJiNjQiOmZhbHNlLCJjcml0IjpbImI2NCIsIm5hbWUiXSwiandrIjp7ImNydiI6InNlY3AyNTZrMSIsIngiOiJ6R1lpTk1jQ2tvOG1henVibGRZNHhqOVc5T3JEaGpJakZiOEYtMlhjT2RBIiwieSI6ImI0SDU4STBjcnlQUnoxT0ZhdVBzTU9STTJ0cFQxcXNiVy1YRUpfZ3pGMDAiLCJrdHkiOiJFQyIsImtpZCI6Ilp4YWhCcUpjQU54S0RTd2xMY2RoRnYwbDVVWGpnazlOWEQ1bDZZMkJrZmcifX0',
          signature: 'XT36eRyB6zyL_TIDRiIY0Z6I_oI4Bt4SRr9eWfccEHFO0j6-NpCHw3yFkbKmVnNI1D0C4I8F6LhViE1jxSKYsw'
        }
      ]
    }
  },
  ed25519: {
    BTC: {
      payload: payloadBTC,
      signatures: [
        {
          protected: 'eyJuYW1lIjoiaWRlbnRpdHlLZXkiLCJhbGciOiJFZERTQSIsInR5cCI6IkpPU0UrSlNPTiIsImI2NCI6ZmFsc2UsImNyaXQiOlsiYjY0IiwibmFtZSJdLCJqd2siOnsiY3J2IjoiRWQyNTUxOSIsIngiOiJoaWRmYVVUa1d6ZURrY1FISnBZYmltUF9NazgtbFloX3lobHAxZDVieGtnIiwia3R5IjoiT0tQIiwia2lkIjoiUXJIZjdqbmlXTlVib0VNeU9kY3BFTnMtRnJqQ0pVZFZqQjBFdUdFRmljMCJ9fQ',
          signature: 'VPnJGPfGYWkoSuB1YctLgY9J76su9NePe0eq9xOgKyjP7StFKHEGfzuIh5WTtlgmn5hGiujHEiv6E2G3JW8GCQ'
        }
      ]
    }
  },
  rsa: {
    BTC: {
      payload: payloadBTC,
      signatures: [
        {
          protected: 'eyJuYW1lIjoiaWRlbnRpdHlLZXkiLCJhbGciOiJSUzUxMiIsInR5cCI6IkpPU0UrSlNPTiIsImI2NCI6ZmFsc2UsImNyaXQiOlsiYjY0IiwibmFtZSJdLCJqd2siOnsiZSI6IkFRQUIiLCJuIjoid3dnOGxjcGVZZ01McUF6LTlTMDhteW11WDdnVGpZX0tUZjR0WTJWVmdpZmZGSDlNelIzMld2YjIwU18wMWs0cnlzcGlEV1ZtTW1DS0pGbnRUeno1ejFtaUQ4NFVvTlBnRE1IbDBGQVhyMW5OenNXelUzV2xLY2xGUkx0LXlRMjdhczVnMUpZWGhKbDhiWXA4NVdpNWQydzBmSUZBS282UURYZi00dVhub1dqdVBUbHBSWlVzdkRLZVhUczVtZjJtbTFzdV8zRkVoSlQ3ZGpxVzZXbHhNZzBxNVZHX2l0SGtYN3JvY3RYd0k3bFV0RDZUQWFaeXY3dHAtNXBrN0l6dS1pLXFOTWZKanFjNlQyZGxwOEZxUDBOQ2Q4V2ZGbFlWWjZKd0hmTUJWSmdrUFUtYktIRkdmUnlGVWZiN0duYkVwdjRTelh2X2JaWkV5SkJyb2lpSzh3Iiwia3R5IjoiUlNBIiwia2lkIjoiNExwZ3FhdzRYMXFIR2NGZnFyNjZYYlo5RTNvVV9DZmstN01xV3FhYWcxMCJ9fQ',
          signature: 'dAPdyjrwJgQpYIArsOiQ71zq70RjpnrTggrjqKaD8yMWPbKYYRpFseAw2BetoMLdFu0ZVCoFEYOlbEC8JAsf5kDgkRgx4uenNWrRTvXCPQaMTV1_VQYLTruwtsGogBZ9wwWlgvgdpRFT72XnZ256msW3StWUL1wHNXvztSQT4KSWbKo0LipyqhnF8FV2H-3qHeftIXvYNRjYP55q-yBFl5dEDAqn3oSMJw3jb2bOaY6YMjpt2gbRHis_0v9h2JN3Bb2WmDX3F3Fbil2oV87Ir-Hlanew0Pr4pXGJaMjhJA06HUmMIdFTQscujWGalAgZ-oHYGgDHX0f5TMKgwVyYeA'
        }
      ]
    }
  }
};

export const bitcorePayId = {
  bitcoreHD: {
    payload: payloadBTC,
    signatures: [
      {
        protected: 'eyJuYW1lIjoiaWRlbnRpdHlLZXkiLCJhbGciOiJFUzI1NksiLCJ0eXAiOiJKT1NFK0pTT04iLCJiNjQiOmZhbHNlLCJjcml0IjpbImI2NCIsIm5hbWUiXSwiandrIjp7Imt0eSI6IkVDIiwiY3J2Ijoic2VjcDI1NmsxIiwidXNlIjoic2lnIiwieCI6Ild6eUVpM1p6RmF5V1N4MGJIYUt4ditKWGF6Rk12R21EeEIwKzR5THZuNjg9IiwieSI6ImJuaHZXYmtwdmprdmFYWFFMUU0vZHVGN3lSSkZENFZZakpteW5KTENoOXM9IiwiZCI6Imt4TW9YTVRKOE53K05GdFZnYWY1elJDa1l2bCtRUXFNRytwZHJrb25YYnM9IiwicHJpdmF0ZSI6dHJ1ZSwicHVibGljIjpmYWxzZX19',
        signature: 'vCJHHPP8gR1Ir3iIbNQmPgxzw_sCgHc-4Ns4KogmapMLpttTbXXZMu-5F5rPQF5SSznX9tq5fHkpzdTeuwtqag'
      }
    ]
  },
  bitcore: {
    payload: payloadBTC,
    signatures: [
      {
        protected: 'eyJuYW1lIjoiaWRlbnRpdHlLZXkiLCJhbGciOiJFUzI1NksiLCJ0eXAiOiJKT1NFK0pTT04iLCJiNjQiOmZhbHNlLCJjcml0IjpbImI2NCIsIm5hbWUiXSwiandrIjp7Imt0eSI6IkVDIiwiY3J2Ijoic2VjcDI1NmsxIiwidXNlIjoic2lnIiwieCI6IkpnRG5oRkJEa2JMbDJRMldhYXIwd3ZlQmh5RDdKL0ZZOWhFdEt0ZXdZdEE9IiwieSI6InBGQ3loWmZFc0JQeDVMNzh5Vjg4S3hnTWlwYS83UmR5aXJWV3k4YzFuSG89IiwiZCI6Ii84NThicWNQL20vNGxBRUJTRFMxMmNNNC9rK0gzdmFYSk82Rzd4ZVRrUEk9IiwicHJpdmF0ZSI6dHJ1ZSwicHVibGljIjpmYWxzZX19',
        signature: 'tFu4QLgZJHgEivPZgn2HSBK4ya9Y_xLk_Gfx1gaUDyMND1iKOjs1VU4aEwalMX1RZydZ-ofu4J9pCrWk3V_ZXw'
      }
    ]
  },
  secp256k1: {
    payload: payloadBTC,
    signatures: [
      {
        protected: 'eyJuYW1lIjoiaWRlbnRpdHlLZXkiLCJhbGciOiJFUzI1NksiLCJ0eXAiOiJKT1NFK0pTT04iLCJiNjQiOmZhbHNlLCJjcml0IjpbImI2NCIsIm5hbWUiXSwiandrIjp7Imt0eSI6IkVDIiwiY3J2Ijoic2VjcDI1NmsxIiwidXNlIjoic2lnIiwiZCI6IlV4MjJQak0yTnZqR1UzSTJQbW52OTNhc1c0Y2hxcGdIOTduZnlKSmR2M1UiLCJ4IjoiekdZaU5NY0NrbzhtYXp1YmxkWTR4ajlXOU9yRGhqSWpGYjhGLTJYY09kQSIsInkiOiJiNEg1OEkwY3J5UFJ6MU9GYXVQc01PUk0ydHBUMXFzYlctWEVKX2d6RjAwIiwicHJpdmF0ZSI6dHJ1ZSwicHVibGljIjpmYWxzZX19',
        signature: 'st5lV71qYe3x-WR8564MHpuT0wM5xrMMmrJlY9g4hQddWbrmaDj9z2Joq0-SryvCU99Oh_rkU9uxfEQUvF9mwA'
      }
    ]
  },
  ed25519: {
    payload: payloadBTC,
    signatures: [
      {
        protected: 'eyJuYW1lIjoiaWRlbnRpdHlLZXkiLCJhbGciOiJFUzI1NksiLCJ0eXAiOiJKT1NFK0pTT04iLCJiNjQiOmZhbHNlLCJjcml0IjpbImI2NCIsIm5hbWUiXSwiandrIjp7Imt0eSI6Ik9LUCIsInVzZSI6InNpZyIsImNydiI6ImVkMjU1MTkiLCJkIjoiOGx3Q19XVWRNZmM3Tzh0SHl6YlE5YVo0WDBpU3BqRGtLRmV1cEdlMFpBTSIsIngiOiJoaWRmYVVUa1d6ZURrY1FISnBZYmltUF9NazgtbFloX3lobHAxZDVieGtnIiwicHJpdmF0ZSI6dHJ1ZSwicHVibGljIjpmYWxzZX19',
        signature: 'EywlWqXww5ufir3Ua5ybx1lhnI8PvyQ3QA38EPeweKVNjJLkCldYASBHFAcLFmMWtgW1rSEytnx1-g63MAXFAg'
      }
    ]
  },
  rsa: {
    payload: payloadBTC,
    signatures: [
      {
        protected: 'eyJuYW1lIjoiaWRlbnRpdHlLZXkiLCJhbGciOiJFUzI1NksiLCJ0eXAiOiJKT1NFK0pTT04iLCJiNjQiOmZhbHNlLCJjcml0IjpbImI2NCIsIm5hbWUiXSwiandrIjp7Imt0eSI6IlJTQSIsInVzZSI6InNpZyIsIm4iOiJ3d2c4bGNwZVlnTUxxQXotOVMwOG15bXVYN2dUallfS1RmNHRZMlZWZ2lmZkZIOU16UjMyV3ZiMjBTXzAxazRyeXNwaURXVm1NbUNLSkZudFR6ejV6MW1pRDg0VW9OUGdETUhsMEZBWHIxbk56c1d6VTNXbEtjbEZSTHQteVEyN2FzNWcxSllYaEpsOGJZcDg1V2k1ZDJ3MGZJRkFLbzZRRFhmLTR1WG5vV2p1UFRscFJaVXN2REtlWFRzNW1mMm1tMXN1XzNGRWhKVDdkanFXNldseE1nMHE1VkdfaXRIa1g3cm9jdFh3STdsVXRENlRBYVp5djd0cC01cGs3SXp1LWktcU5NZkpqcWM2VDJkbHA4RnFQME5DZDhXZkZsWVZaNkp3SGZNQlZKZ2tQVS1iS0hGR2ZSeUZVZmI3R25iRXB2NFN6WHZfYlpaRXlKQnJvaWlLOHciLCJlIjoiQVFBQiIsImQiOiJrTVFlWkhsUVVhUTlGTUtBeFhDTW1nZjRYU2hfcXdaZWZrSDdZdG9tX0hPb0RNanBNeF9ZYTNFQmlBajJ6ZFE4Z1V4ME44bGFjRzVrVzlNOGFTS3pzd3V2VmRmOFM5eTVZXzdSSFMwMlIzeDdYYzQxNi05Wlo0ajBsNjRzMEFRWFo1SkZJY2NfTWJmVU9tTWZqaEdNQ1c4U0RwREtGa3kzOUtkclZQU2VXSm9FZHpkNDF6RVY1N2xkSWxxeDFuMVE0R1RYMy05V1M5eHk2bC1raDAxNGk3QjJpUTlUVU1qVUtlZXZPNFF0TjRJUFhlUnJYX3I4M1BGQWRCS3BiVDJkMDVBQ21GMlZpcjBmTmVHY1hpZlJGTjdwT0tzSTlOcnVJbHhvMkowM3MxX3JOdldMUmlkVG5FZEkyOW4ydWxhaThPX0VUQnZVQVBnMzd0UWN6VUtQa1EiLCJwIjoiNl9EWjhZUW9fbTRwbC1kUmNhang4cUNHWlhpRVNxX1d1QTRBNlE3aHZzRnZUdWkzUzkwSTVHOGtPSTlkREtMQVI4eWo1MG9OTnZ3emRIVXdISFh5SWVHTVh3a21ELTNYc3RMcmpiUVhHSjdnbmx0N0h6T3lHa1ZEd2NEZ0Q3Wk03M3B6WDJISnMycENSdE9FcTFiWmlrb0c0THZSanVrUjFmQURYWXhrMWFVIiwicSI6IjA1MEd4ZTZRbE1XcW5IOEhYYWRhbjNxRnJnVm1BSG4tR3A1TXh2dC1rcGg2NTVFWFRETHRCWnZpVXdxRE94MmUySzRJa1B0RndfX19LSGctSExqS2dXVGtlV2VrLWxMaFE2Qk9mVzFvUHk3Y3pmQnI0RmtCYUFlaUtVSkJnLThiV3pSV1I4YXUyVG1YSkNJZ2xPN1ZUeDdvQ0hiYVJtODJxS3prbXFPdjZyYyIsImRwIjoiSXFUWDY1MmpRMUM3ck1GYmRSd0Fnc2JOVlNMd0VlTmwzTnE1aVg4VTZLU1FpbjZqUTNGdU45U1Y5ZlFmRHBick10LTZoV0NiTmlLc0Q0S1JrT3hFcEhMdzRKZUFUa0IzTnB1XzJLdkQ1R3FYd3NqZC1FUG45X0dKdEc1MHRfbmxyQmhIem82V1JsRG84R3RvaEp3WkR6UTFkRlFfdmdNOUNqUFcycXFkdDcwIiwiZHEiOiJiRGhsLWx1aV9US0pxamNjb1R5eEQ5WXNfMjRyV0JzTFpMbUlNa3J6MUN5LXppWlpiOUtyZks3WDhfZndYUThzNlVzM2ZrM0N4QlhyZTlyaWlQWElPcHhLYV93aFZ4T0R1SDRISmdZSnhpWkZMZHpDanAxMkpxbWd1TkQxaUctRDRnVEdDemNFdkhyRFhPdEhGbU4tRzFTR19hMHF1OUtzZFY3V0dtLVR5OGsiLCJxaSI6IkN1bWdOdkdPZkhTd3c5R1RWa3dCN01zSmpSeWN0NUhISlNxdEJpbUtpcTM4WjlDdmwzV01zcDZuT3UtVy12RzRQZkg1dFZMVV9QOUFpLXl6Z194ODVUaXBjVTlwQU1QaTVBNExGM2puWGlVRkJ5OElyeDVhNGtlbGQzWGZxeG55QWtsUmxoYlQ3S0dBbzBkaGpid0pMaDExVTFORnZtMWVGeVZfS0Z4ZWlERSIsImxlbmd0aCI6MjA0OCwicHJpdmF0ZSI6dHJ1ZSwicHVibGljIjpmYWxzZX19',
        signature: 'V7Sb0S_cJc9Fus_h8CRmIVcq7X5PNPj_hHHsf9_MNvj98MabfTC8oq_ySERBLEJ0d4jzs1OO1PyKacK_uO5LOHdpKh5k5pIlVrXKJyia1PoqjAbPm16hcQzFW3z3wLsbYyOsHWiPOIlpsh3PtnqBg15MyH1rzIWdHmZVVyOQvAsEaDgEI0HXMwOANgkglKr5Vi5wP8pkUmOqBKm10xpR0uNN7RpAM1lLX80eQT_T7UQGVFvCDEhNivWK6vNFj955x0zh8crUEjrkNmF1N4OugCNDoWR_5BqJAFYOereLPQnbPfb42zzMilvFMwaosdK2DFefkag3957pOot7-5T1gA'
      }
    ]
  }
};

export default {
  payIdOrgUtils,
  bitcorePayId
};
