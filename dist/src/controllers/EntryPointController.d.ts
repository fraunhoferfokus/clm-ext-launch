import { BaseExtensionCtrl } from "clm-core";
import express from 'express';
declare class LaunchController extends BaseExtensionCtrl {
    specTranslator: express.Handler;
    lti11form: express.Handler;
    cmi5form: express.Handler;
    lti11_launchData: express.Handler;
}
declare const controller: LaunchController;
export default controller;
