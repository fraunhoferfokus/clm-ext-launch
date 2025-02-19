"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const body_parser_1 = __importDefault(require("body-parser"));
const clm_core_1 = require("clm-core");
const crypto_1 = require("crypto");
const fs_1 = __importDefault(require("fs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const node_jose_1 = __importDefault(require("node-jose"));
const server_1 = require("../../server");
const publicKeyPath = '/src/jwks/public_key.pub';
const privateKeyPath = '/src/jwks/private_key.pem';
const KID = process.env.KID || '1';
const encryptService = new clm_core_1.EncryptService(process.env.LOGIN_HINT_ENCRYPT_KEY || 'secret');
let public_key, private_key;
if (!fs_1.default.existsSync(server_1.ROOT_DIR + publicKeyPath) || !fs_1.default.existsSync(server_1.ROOT_DIR + privateKeyPath)) {
    (() => __awaiter(void 0, void 0, void 0, function* () {
        const { public_key: pubKey, private_key: privKey } = yield new Promise((resolve, reject) => {
            (0, crypto_1.generateKeyPair)('rsa', {
                modulusLength: 2048,
                publicKeyEncoding: {
                    type: 'spki',
                    format: 'pem'
                },
                privateKeyEncoding: {
                    type: 'pkcs8',
                    format: 'pem'
                }
            }, (err, public_key, private_key) => {
                if (err)
                    return reject(err);
                return resolve({ public_key, private_key });
            });
        });
        fs_1.default.writeFileSync(server_1.ROOT_DIR + publicKeyPath, pubKey);
        fs_1.default.writeFileSync(server_1.ROOT_DIR + privateKeyPath, privKey);
    }))();
}
else {
    public_key = fs_1.default.readFileSync(server_1.ROOT_DIR + publicKeyPath, 'utf-8');
    private_key = fs_1.default.readFileSync(server_1.ROOT_DIR + privateKeyPath, 'utf-8');
}
class LTI13Controller extends clm_core_1.BaseExtensionCtrl {
    constructor() {
        super(...arguments);
        this.platformDetails = (req, res, next) => __awaiter(this, void 0, void 0, function* () {
            return res.json(this.construcPlatformDetails());
        });
        this.construcPlatformDetails = () => {
            let clmUrl = process.env.DEPLOY_URL;
            let iss = clmUrl;
            let clientId = clmUrl;
            let authReqUrl = `${clmUrl}/launch/lti13/auth`;
            let publicKeySetUrl = `${clmUrl}/launch/lti13/jwks`;
            let tokenUrl = `${clmUrl}/launch/lti13/token`;
            return {
                platformName: clmUrl,
                iss,
                clientId,
                authReqUrl,
                publicKeySetUrl,
                tokenUrl
            };
        };
        this.authReqUrl = (req, res, next) => __awaiter(this, void 0, void 0, function* () {
            try {
                let { scope, response_type, response_mode, prompt, client_id, redirect_uri, state, nonce, lti_message_hint, login_hint } = req.query;
                let arr = ['scope', 'response_type', 'prompt', 'client_id', 'redirect_uri', 'state', 'nonce'];
                for (let item of arr) {
                    if (!req.query[item])
                        return next({ message: `Must include parameter: ${item}` });
                }
                let decryptedLoginHint;
                try {
                    decryptedLoginHint = JSON.parse(encryptService.decrypt(login_hint));
                }
                catch (err) {
                    return next({ message: 'Not valid login_hint', status: 400 });
                }
                if (decryptedLoginHint.target_link_uri !== redirect_uri || decryptedLoginHint.client_id !== client_id)
                    return next({ message: 'Invalid redirect_uri with specified client_id', status: 400 });
                let id_token = yield this.constructIdToken(decryptedLoginHint, nonce);
                return res.render('lti13/auth', {
                    id_token,
                    state,
                    redirect_uri
                });
            }
            catch (err) {
                return next(err);
            }
        });
        this.constructIdToken = (decryptedIdToken, nonce) => __awaiter(this, void 0, void 0, function* () {
            try {
                let platformDetails = this.construcPlatformDetails();
                // let context = decryptedIdToken.context
                let payload = {
                    iss: platformDetails.iss,
                    aud: platformDetails.clientId,
                    sub: decryptedIdToken.userId,
                    iat: Math.floor(Date.now() / 1000),
                    nonce,
                    "https://purl.imsglobal.org/spec/lti/claim/deployment_id": decryptedIdToken.deployment_id,
                    "https://purl.imsglobal.org/spec/lti/claim/target_link_uri": decryptedIdToken.target_link_uri,
                    "https://purl.imsglobal.org/spec/lti/claim/resource_link": {
                        "id": decryptedIdToken.resourceLinkId
                    },
                    "https://purl.imsglobal.org/spec/lti/claim/roles": decryptedIdToken.roles,
                    "https://purl.imsglobal.org/spec/lti/claim/version": "1.3.0",
                    "https://purl.imsglobal.org/spec/lti/claim/message_type": "LtiResourceLinkRequest",
                    "https://purl.imsglobal.org/spec/lti/claim/custom": {
                        id: decryptedIdToken.customId
                    }
                };
                let token = yield new Promise((resolve, reject) => {
                    return jsonwebtoken_1.default.sign(payload, private_key, {
                        expiresIn: '1h', keyid: KID, algorithm: "RS256",
                    }, (err, token) => {
                        if (err)
                            return reject(err.message);
                        return resolve(token);
                    });
                });
                return token;
            }
            catch (err) {
                throw err;
            }
        });
        this.jwks = (req, res, next) => __awaiter(this, void 0, void 0, function* () {
            try {
                const key = yield node_jose_1.default.JWK.asKey(public_key, 'pem');
                const jwk = key.toJSON();
                //@ts-ignore 
                jwk['kid'] = '1';
                const jwks = {
                    keys: [
                        jwk
                    ]
                };
                return res.json(jwks);
            }
            catch (err) {
                return next(err);
            }
        });
        this.accessTokenUrl = (req, res, next) => __awaiter(this, void 0, void 0, function* () {
            try {
                return res.json('access_token');
            }
            catch (err) {
                return next(err);
            }
        });
    }
    generateNonce(length) {
        const characters = 'abcdefghijklmnopqrstuvwxyz0123456789';
        let nonce = '';
        for (let i = 0; i < length; i++) {
            const randomIndex = Math.floor(Math.random() * characters.length);
            nonce += characters[randomIndex];
        }
        return 'nonce-' + nonce;
    }
}
let controller = new LTI13Controller();
controller.router.use(body_parser_1.default.urlencoded({ extended: true }));
controller.router.get('/platformDetails', controller.platformDetails);
controller.router.get('/auth', controller.authReqUrl);
controller.router.get('/jwks', controller.jwks);
controller.router.get('/token', controller.accessTokenUrl);
exports.default = controller;
