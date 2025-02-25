import { BaseExtensionCtrl, UserModel } from "clm-core";
import express from 'express';
import { SPModel } from "clm-ext-service_providers";
declare class Cmi5Controller extends BaseExtensionCtrl {
    lrsDependency: (lrsIds: string[], tool: any, user: UserModel, agent: any) => Promise<void>;
    launch: express.Handler;
    getActivities: express.Handler;
    getActivityState: express.Handler;
    putActivityState: express.Handler;
    profile: express.Handler;
    authTokenGenerator: express.Handler;
    tokenMW: express.Handler;
    statements: express.Handler;
    lrsProxy: (req: express.Request, res: express.Response, next: express.NextFunction, lrss: SPModel[], path: string, method?: ("PUT" | "POST" | "GET")) => Promise<void | express.Response<any, Record<string, any>>>;
}
declare const controller: Cmi5Controller;
export default controller;
