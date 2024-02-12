/* -----------------------------------------------------------------------------
 *  Copyright (c) 2023, Fraunhofer-Gesellschaft zur Förderung der angewandten Forschung e.V.
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as published by
 *  the Free Software Foundation, version 3.
 *
 *  This program is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 *  GNU Affero General Public License for more details.
 *
 *  You should have received a copy of the GNU Affero General Public License
 *  along with this program. If not, see <https://www.gnu.org/licenses/>.  
 *
 *  No Patent Rights, Trademark Rights and/or other Intellectual Property
 *  Rights other than the rights under this license are granted.
 *  All other rights reserved.
 *
 *  For any other rights, a separate agreement needs to be closed.
 *
 *  For more information please contact:  
 *  Fraunhofer FOKUS
 *  Kaiserin-Augusta-Allee 31
 *  10589 Berlin, Germany
 *  https://www.fokus.fraunhofer.de/go/fame
 *  famecontact@fokus.fraunhofer.de
 * -----------------------------------------------------------------------------
 */
import { BaseDatamodel, iBaseDatamodel } from "clm-core";


interface iLTI1_3Consumer {
    _id?: string;
    _rev?: string;
    issuer?: string;
    client_id?: string;
    key_set_url?: string;
    auth_token_url?: string;
    auth_login_url?: string
}

export default class LTI1_3ConsumerModel extends BaseDatamodel implements iLTI1_3Consumer {
    issuer?: string;
    client_id?: string;
    key_set_url?: string;
    auth_token_url?: string;
    auth_login_url?: string
    constructor(payload: iLTI1_3Consumer) {
        super(payload)
        this.issuer = payload.issuer
        this.client_id = payload.client_id
        this.key_set_url = payload.key_set_url
        this.auth_token_url = payload.auth_login_url
        this.auth_token_url = payload.auth_token_url
    }
}