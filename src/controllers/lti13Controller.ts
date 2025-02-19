import bodyParser from 'body-parser';
import { BaseExtensionCtrl, EncryptService } from 'clm-core';
import { generateKeyPair } from 'crypto';
import express from 'express';
import fs from 'fs';
import jwt from 'jsonwebtoken';
import jose from 'node-jose';
import { ROOT_DIR } from '../../server';
import { Context } from '../services/LaunchService';

const publicKeyPath = '/src/jwks/public_key.pub';
const privateKeyPath = '/src/jwks/private_key.pem';
const KID = process.env.KID || '1'
const encryptService = new EncryptService(process.env.LOGIN_HINT_ENCRYPT_KEY || 'secret');

interface LoginHint {
    clientId: string
    client_id: string
    target_link_uri: string
    userId: string
    toolId: string
    roles: string[],
    context: Context,
    deployment_id: string,
    resourceLinkId: string,
    customId: string
}


let public_key: string, private_key: string;
if (!fs.existsSync(ROOT_DIR + publicKeyPath) || !fs.existsSync(ROOT_DIR + privateKeyPath)) {

    (async () => {

        const { public_key: pubKey, private_key: privKey } = await new Promise((resolve, reject) => {
            generateKeyPair('rsa', {
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
                if (err) return reject(err)
                return resolve({ public_key, private_key })
            });
        }) as { public_key: string, private_key: string }

        fs.writeFileSync(ROOT_DIR + publicKeyPath, pubKey)
        fs.writeFileSync(ROOT_DIR + privateKeyPath, privKey)



    })();
} else {
    public_key = fs.readFileSync(ROOT_DIR + publicKeyPath, 'utf-8')
    private_key = fs.readFileSync(ROOT_DIR + privateKeyPath, 'utf-8')
}


class LTI13Controller extends BaseExtensionCtrl {

    platformDetails: express.Handler = async (req, res, next) => {
        return res.json(this.construcPlatformDetails())
    }

    construcPlatformDetails = () => {
        let clmUrl = process.env.DEPLOY_URL
        let iss = clmUrl
        let clientId = clmUrl
        let authReqUrl = `${clmUrl}/launch/lti13/auth`
        let publicKeySetUrl = `${clmUrl}/launch/lti13/jwks`
        let tokenUrl = `${clmUrl}/launch/lti13/token`
        return {
            platformName: clmUrl,
            iss,
            clientId,
            authReqUrl,
            publicKeySetUrl,
            tokenUrl
        }
    }


    authReqUrl: express.Handler = async (req, res, next) => {
        try {
            let { scope, response_type, response_mode, prompt, client_id, redirect_uri, state, nonce, lti_message_hint, login_hint } = req.query

            let arr = ['scope', 'response_type', 'prompt', 'client_id', 'redirect_uri', 'state', 'nonce']

            for (let item of arr) {
                if (!req.query[item]) return next({ message: `Must include parameter: ${item}` })
            }

            let decryptedLoginHint: LoginHint
            try {
                decryptedLoginHint = JSON.parse(encryptService.decrypt(login_hint as string))
            } catch (err) {
                return next({ message: 'Not valid login_hint', status: 400 })
            }

            if (decryptedLoginHint.target_link_uri !== redirect_uri || decryptedLoginHint.client_id !== client_id) return next({ message: 'Invalid redirect_uri with specified client_id', status: 400 })

            let id_token = await this.constructIdToken(decryptedLoginHint, nonce as string)

            return res.render('lti13/auth', {
                id_token,
                state,
                redirect_uri
            })

        } catch (err: any) {
            return next(err)
        }
    }

    public generateNonce(length: number) {
        const characters = 'abcdefghijklmnopqrstuvwxyz0123456789';
        let nonce = '';
        for (let i = 0; i < length; i++) {
            const randomIndex = Math.floor(Math.random() * characters.length);
            nonce += characters[randomIndex];
        }
        return 'nonce-' + nonce;
    }

    private constructIdToken = async (decryptedIdToken: LoginHint, nonce: string) => {
        try {

            let platformDetails = this.construcPlatformDetails()
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
            }

            let token: any = await new Promise((resolve, reject) => {
                return jwt.sign(payload, private_key, {
                    expiresIn: '1h', keyid: KID, algorithm: "RS256",
                }, (err, token) => {
                    if (err) return reject(err.message)
                    return resolve(token)
                })
            })



            return token


        } catch (err) {
            throw err
        }
    }


    jwks: express.Handler = async (req, res, next) => {
        try {
            const key = await jose.JWK.asKey(public_key, 'pem')
            const jwk = key.toJSON();

            //@ts-ignore 
            jwk['kid'] = '1'

            const jwks = {
                keys: [
                    jwk
                ]
            }
            return res.json(jwks)
        } catch (err) {
            return next(err)
        }
    }

    accessTokenUrl: express.Handler = async (req, res, next) => {
        try {
            return res.json('access_token')
        } catch (err) {
            return next(err)
        }
    }

}

let controller = new LTI13Controller()
controller.router.use(bodyParser.urlencoded({ extended: true }))
controller.router.get('/platformDetails', controller.platformDetails)
controller.router.get('/auth', controller.authReqUrl)
controller.router.get('/jwks', controller.jwks)
controller.router.get('/token', controller.accessTokenUrl)


export default controller



