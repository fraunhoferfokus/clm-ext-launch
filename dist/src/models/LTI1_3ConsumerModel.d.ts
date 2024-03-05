import { BaseDatamodel } from "clm-core";
interface iLTI1_3Consumer {
    _id?: string;
    _rev?: string;
    issuer?: string;
    client_id?: string;
    key_set_url?: string;
    auth_token_url?: string;
    auth_login_url?: string;
}
export default class LTI1_3ConsumerModel extends BaseDatamodel implements iLTI1_3Consumer {
    issuer?: string;
    client_id?: string;
    key_set_url?: string;
    auth_token_url?: string;
    auth_login_url?: string;
    constructor(payload: iLTI1_3Consumer);
}
export {};
