const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());
const ac = require("@antiadmin/anticaptchaofficial");

async function main() {
    ac.setAPIKey(process.env.ANTICAPTCHA_KEY || 'dummy_key_just_to_test_interception');
    
    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();
    
    await page.setRequestInterception(true);
    page.on('request', interceptedRequest => {
        const url = interceptedRequest.url();
        if (url.includes('recaptcha/api.js') || url.includes('recaptcha/enterprise.js')) {
            console.log('Blocked CAPTCHA JS:', url);
            interceptedRequest.respond({
                status: 200,
                contentType: 'application/javascript',
                body: `
                    window.grecaptcha = {
                        ready: function(cb) { cb(); },
                        execute: function(sitekey, params) {
                            console.log("MOCK grecaptcha.execute called with", sitekey);
                            return Promise.resolve("MOCK_TOKEN");
                        },
                        render: function(container, params) {
                            console.log("MOCK grecaptcha.render called", params);
                            window.mockRecaptchaParams = params;
                            return 0;
                        },
                        getResponse: function() {
                            return "MOCK_TOKEN";
                        }
                    };
                    if (window.onloadCallback) window.onloadCallback();
                `
            });
        } else {
            interceptedRequest.continue();
        }
    });
    
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    
    await page.goto('https://srienlinea.sri.gob.ec/auth/realms/Internet/protocol/openid-connect/auth?client_id=app-sri-claves-angular&redirect_uri=https%3A%2F%2Fsrienlinea.sri.gob.ec%2Fsri-en-linea%2Finicio%2FNAT&response_mode=fragment&response_type=code&scope=openid', { waitUntil: 'domcontentloaded' });
    
    await new Promise(r => setTimeout(r, 5000));
    await browser.close();
}
main();
