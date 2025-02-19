import { BaseExtensionCtrl } from 'clm-core';
import express from 'express';
declare class LTI13Controller extends BaseExtensionCtrl {
    platformDetails: express.Handler;
    construcPlatformDetails: () => {
        platformName: string | undefined;
        iss: string | undefined;
        clientId: string | undefined;
        authReqUrl: string;
        publicKeySetUrl: string;
        tokenUrl: string;
    };
    authReqUrl: express.Handler;
    generateNonce(length: number): string;
    private constructIdToken;
    jwks: express.Handler;
    accessTokenUrl: express.Handler;
}
declare let controller: LTI13Controller;
export default controller;
