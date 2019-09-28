var Service, Characteristic;
var request = require('request');


module.exports = function(homebridge){
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;
    homebridge.registerAccessory('homebridge-better-http-rgb', 'HTTP-RGB', HTTP_RGB);
};

function HTTP_RGB(log, config) {

    // The logging function is required if you want your function to output
    // any information to the console in a controlled and organized manner.
    this.log = log;

    this.name                          = config.name               ||"HTTP RGB";
    this.statusUrl                     = config["statusUrl"];
    this.timeout                       = config["timeout"]         || 5000;
    this.kind                          = config["kind"]            || "None"; //RGB / CCWW
    this.brightness                     = config["brightness"]     || false; //true / false

}

HTTP_RGB.prototype = {

    getServices: function() {
        var that = this;
        var informationService = new Service.AccessoryInformation();

        informationService
            .setCharacteristic(Characteristic.Manufacturer, 'HTTP Manufacturer')
            .setCharacteristic(Characteristic.Model, 'homebridge-better-http-rgb')
            .setCharacteristic(Characteristic.SerialNumber, 'HTTP Serial Number');

        this.lightbulbService = new Service.Lightbulb(this.name);

            this.lightbulbService
                .getCharacteristic(Characteristic.On)
                .on('get', this.getPowerState.bind(this))
                .on('set', this.setPowerState.bind(this));  

        if (this.brightness){
        this.lightbulbService
                .addCharacteristic(new Characteristic.Brightness())
                .on('get', this.getBrightness.bind(this))
                .on('change', this.setBrightness.bind(this)); 
        }

        switch (this.kind){
            case 'RGB':
                this.lightbulbService
                    .addCharacteristic(new Characteristic.Hue())
                    .on('get', this.getHue.bind(this))
                    .on('change', this.setHue.bind(this));

                this.lightbulbService
                    .addCharacteristic(new Characteristic.Saturation())
                    //.on('get', this.getSaturation.bind(this))
                    .on('change', this.setSaturation.bind(this));
                break;
            case 'CCWW':
                this.lightbulbService
                    .addCharacteristic(new Characteristic.ColorTemperature())
                    .on('get', this.getColorTemperature.bind(this))
                    .on('change', this.setColorTemperature.bind(this));
                break;
        }
        return [this.lightbulbService];
    },

    //** Custom Functions **//

    getPowerState: function (callback) {
        if (!this.statusUrl) 
        {
            this.log("Ignoring request: Missing status properties in config.json.");
            callback(new Error("No status url defined."));
            return;
        }

        var url = this.statusUrl;
                
        this._httpRequest(url + "/cm?cmnd=status", "", "GET", function (error, response, responseBody) 
        {
            if (error) 
            {
                this.log('HTTP get status function failed: %s', error.message);
                callback(error);
            }
            else 
            {
                var powerOn = false;
                var json = JSON.parse(responseBody);
                var status = json.Status.Power;
                
                if (status != 0) 
                {
                    powerOn = 1;
                    this.log("Power state is currently ON");
                }
                else 
                {
                    powerOn = 0;
                    this.log("Power state is currently OFF");
                }

                callback(null, powerOn);
            }
        }.bind(this));
    },

    setPowerState: function (powerOn, callback) {
        var url;
        var body;
        var inuse;
        
        var that = this;
        
        if (powerOn) 
        {
            url = this.statusUrl+"/cm?cmnd=Power%20On";
            inuse = 1;
            this.log("Setting power state to ON");
        } 
        else 
        {
            url = this.statusUrl+"/cm?cmnd=Backlog%20dimmer%200%3BPower%20Off";
            inuse = 0;
            this.log("Setting power state to OFF");
        }
        
        this._httpRequest(url, "", "GET", function (error, response, body)
        {
            if (error)
            {
                that.log("HTTP set status function failed %s", error.message);
            } 
        }.bind(this))   

        
        callback(); 
    },

    getBrightness: function(callback) {
        var url = this.statusUrl;
        this._httpRequest(url + "/cm?cmnd=dimmer", "", "GET", function (error, response, responseBody) 
        {
            if (error) 
            {
                this.log('HTTP get status function failed: %s', error.message);
                callback(error);
            }
            else 
            {
                var Dimmer;
                var json = JSON.parse(responseBody);
                Dimmer = json.Dimmer;

                this.log("Dimmer Value is: " + Dimmer);
                callback(null, Dimmer);
            }
        }.bind(this));
    },

    setBrightness: function(level, callback) {
        var url = this.statusUrl;   
        var that = this;

        this.log("Brightness level in now Set to: " + level.newValue);
        

        this._httpRequest(url + "/cm?cmnd=dimmer%20" + level.newValue, "", "GET", function (error, response, body)
            {
                if (error)
                {
                    that.log("HTTP set status function failed %s", error.message);
                } 
            }.bind(this));
    },

    getHue: function(callback) {
        var url = this.statusUrl;
        this._httpRequest(url + "/cm?cmnd=HSBColor", "", "GET", function (error, response, responseBody) 
        {
            if (error) 
            {
                this.log('HTTP get status function failed: %s', error.message);
                callback(error);
            }
            else 
            {
                var Hue;
                var json = JSON.parse(responseBody);
                Hue = json.HSBColor.substring(0,json.HSBColor.indexOf(","));

                this.log("Hue Value is: " + Hue);
                callback(null, Hue);
            }
        }.bind(this));
    },

    setHue: function(hue, callback) {
        var url = this.statusUrl;   
        var that = this;
        var hue = hue.newValue;
        var sat = this.lightbulbService.getCharacteristic(Characteristic.Saturation).value;
        var bri = this.lightbulbService.getCharacteristic(Characteristic.Brightness).value;;

        var rgb = this._hsvToRgb(hue,sat, bri);
        var r = this._decToHex(rgb.r);
        var g = this._decToHex(rgb.g);
        var b = this._decToHex(rgb.b);

        this.log("Hue level in now Set to: " + hue);

        this._httpRequest(url + "/cm?cmnd=Color%20" + r + g + b +"0000", "", "GET", function (error, response, body)
            {
                if (error)
                {
                    that.log("HTTP set status function failed %s", error.message);
                } 
            }.bind(this));
    },

    getSaturation: function(callback) {
        var url = this.statusUrl;
        this._httpRequest(url + "/cm?cmnd=HSBColor", "", "GET", function (error, response, responseBody) 
        {
            if (error) 
            {
                this.log('HTTP get status function failed: %s', error.message);
                callback(error);
            }
            else 
            {
                var Sat;
                var json = JSON.parse(responseBody);
                Sat = json.HSBColor.substring(json.HSBColor.indexOf(",")+1,json.HSBColor.lastIndexOf(","));

                this.log("Saturation Value is: " + Sat);
                callback(null, Sat);
            }
        }.bind(this));
    },

    setSaturation: function(sat, callback) {
        var url = this.statusUrl;   
        var that = this;
        var hue = this.lightbulbService.getCharacteristic(Characteristic.Hue).value;
        var sat = sat.newValue;
        var bri = this.lightbulbService.getCharacteristic(Characteristic.Brightness).value;

        var rgb = this._hsvToRgb(hue,sat, bri);
        var r = this._decToHex(rgb.r);
        var g = this._decToHex(rgb.g);
        var b = this._decToHex(rgb.b);


        this.log("Saturation level in now Set to: " + sat);
        

        this._httpRequest(url + "/cm?cmnd=Color%20" + r + g + b +"0000", "", "GET", function (error, response, body)
            {
                if (error)
                {
                    that.log("HTTP set status function failed %s", error.message);
                } 
            }.bind(this));
    },

    getColorTemperature: function(callback) {
        var url = this.statusUrl;
        this._httpRequest(url + "/cm?cmnd=CT", "", "GET", function (error, response, responseBody) 
        {
            if (error) 
            {
                this.log('HTTP get status function failed: %s', error.message);
                callback(error);
            }
            else 
            {
                var Temp;
                var json = JSON.parse(responseBody);
                Temp = json.CT;

                Temp = Math.round(((Temp - 153) / (500 - 153)) * (500 - 140) + 140);

                this.log("Temperature Value is: " + Temp);
                callback(null, Temp);
            }
        }.bind(this));
    },

    setColorTemperature: function(temp, callback) {
        var url = this.statusUrl;   
        var that = this;
        var temp = temp.newValue;

        temp = Math.round(((temp - 140) / (500 - 140)) * (500 - 153) + 153); //Convert Homebrige range to Tasmota range

        this.log("Temperature level in now Set to: " + temp);

        this._httpRequest(url + "/cm?cmnd=CT%20" + temp, "", "GET", function (error, response, body)
            {
                if (error)
                {
                    that.log("HTTP set status function failed %s", error.message);
                } 
            }.bind(this));
    },

    _httpRequest: function (url, body, method, callback) {
        var callbackMethod = callback;
        
        request({
            url: url,
            body: body,
            method: method,
            timeout: this.timeout,
            rejectUnauthorized: false
            },
            function (error, response, responseBody) 
            {
                if (callbackMethod) 
                {
                    callbackMethod(error, response, responseBody)
                }
                else 
                {
                    //this.log("callbackMethod not defined!");
                }
            })
    },

    _hsvToRgb: function(h, s, v) {
        var r, g, b, i, f, p, q, t;

        h /= 360;
        s /= 100;
        v /= 100;

        i = Math.floor(h * 6);
        f = h * 6 - i;
        p = v * (1 - s);
        q = v * (1 - f * s);
        t = v * (1 - (1 - f) * s);
        switch (i % 6) {
            case 0: r = v; g = t; b = p; break;
            case 1: r = q; g = v; b = p; break;
            case 2: r = p; g = v; b = t; break;
            case 3: r = p; g = q; b = v; break;
            case 4: r = t; g = p; b = v; break;
            case 5: r = v; g = p; b = q; break;
        }
        var rgb = { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
        return rgb;
    },

    _rgbToHsl: function(r, g, b){
        r /= 255;
        g /= 255;
        b /= 255;
        var max = Math.max(r, g, b), min = Math.min(r, g, b);
        var h, s, l = (max + min) / 2;

        if(max == min){
            h = s = 0; // achromatic
        }else{
            var d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            switch(max){
                case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                case g: h = (b - r) / d + 2; break;
                case b: h = (r - g) / d + 4; break;
            }
            h /= 6;
        }

        h *= 360; // return degrees [0..360]
        s *= 100; // return percent [0..100]
        l *= 100; // return percent [0..100]
        return [parseInt(h), parseInt(s), parseInt(l)];
    },

    _decToHex: function(d, padding) {
        var hex = Number(d).toString(16).toUpperCase();
        padding = typeof (padding) === 'undefined' || padding === null ? padding = 2 : padding;

        while (hex.length < padding) {
            hex = '0' + hex;
        }

        return hex;
    }

};