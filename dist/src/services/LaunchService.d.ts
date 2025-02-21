import { UserModel } from "clm-core";
import { ToolModel } from "clm-ext-tools";
import express from 'express';
export type Context = {
    context_id: string;
    context_title: string;
    context_label: string;
    context_type: string;
};
declare class LaunchService {
    private initialize_lti13_launch;
    private launch_lti11_tool;
    private launch_cmi5_tool;
    getPrerenderedLTI1_1Launch(toolId: string): express.Handler;
    private getFullLaunchDataObject;
    private getStandardLTIParams;
    private getOtherParameters;
    getUserAndTool(accessToken: string, email: string, toolId: string): Promise<{
        tool: ToolModel;
        user: UserModel;
    }>;
    validate_lti11_request(body: any): {
        email: any;
        accessToken: any;
    };
    validate_cmi5_request(query: any): {
        email: any;
        accessToken: any;
    };
    launchSpecification(type: ('CMI5' | 'LTI13' | 'LTI11'), tool: ToolModel, user: UserModel, accessToken: string, context: Context): express.Handler;
}
declare const _default: LaunchService;
export default _default;
