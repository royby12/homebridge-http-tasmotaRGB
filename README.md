# homebridge-http-tasmotaRGB

## Config:
```
{
  "accessory": "HTTP-RGB",
  "name": "SonoffRGB",
  "statusUrl": "http://[BULB_IP]",
  "kind": "CW",  //RGB / CW / NONE - On/off only
  "brightness": "true", //true / false - Default
  "timeout": 3000  //5000 Default
}
```

inspired by: https://www.npmjs.com/package/homebridge-better-http-rgb
