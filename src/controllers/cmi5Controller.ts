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
import { AuthGuard, BaseExtensionCtrl, UserModel } from "clm-core";
import express from 'express'
import { spBDTOInstance, SPModel } from "clm-ext-service_providers"
import axios from 'axios'
import { CourseStructureJSON } from "clm-ext-learning_objects";
import sha1 from 'sha1'
import queryString from 'query-string'
import { v4 as uuid } from 'uuid'
let state: { [key: string]: any } = {};

let baseurl = (process.env.DEPLOY_URL || '') + (process.env.BASE_PATH || '/launch')

class Cmi5Controller extends BaseExtensionCtrl {

    lrsDependency = async (lrsIds: string[], tool: any, user: UserModel, agent: any) => {
        const lrss = (await spBDTOInstance.findAll()).filter((service) => lrsIds.includes(service._id));

        const stringified = queryString.stringify({
            stateId: 'LMS.LaunchData',
            activityId: tool.activityId,
            agent: agent,
            registration: tool._id
        })


        const putRequests = [];
        for (const lrs of lrss) {
            const token = Buffer.from(`${lrs.username}:${lrs.password}`).toString('base64');
            const headers = {
                authorization: `Basic ${token}`,
                'x-experience-api-version': '1.0.0',
                'Content-Type': 'application/json'
            }
            const fullUrl = `${lrs.baseUrl}/activities/state?${stringified}`;
            putRequests.push(axios.put(fullUrl,
                {
                    "contextTemplate": {
                        "contextActivities": {
                            "grouping": {
                                "id": "http://example.com/activities/hang-gliding-school"
                            }
                        },
                        "extensions": {
                            "https://w3id.org/xapi/cmi5/context/extensions/sessionid": "http://t1RZa11ZmyhCOLK4SbvXMnnM_wY-EWza_rise/activity"
                        }
                    },
                    "launchMode": "Normal"
                },
                { headers }
            ).then(
                async () => {
                    const query = queryString.stringify({
                        profileId: 'cmi5LearnerPreferences',
                        agent: agent,
                    })
                    const url = `${lrs.baseUrl}/agents/profile?${query}`
                    try {
                        await axios.put(url, {
                            "languagePreference": "en-US,fr-FR,de-DE",
                            "context": {
                                "audioPreference": "off"
                            }
                        }
                            , { headers: { 'if-none-match': "*", ...headers } })
                    } catch (err: any) {
                        const status = err?.response?.status;
                        if (status !== 412) throw err;
                    }

                }).catch((err) => { throw err })
            )
        }

        await Promise.all(putRequests);
    }


    launch: express.Handler = async (req, res, next) => {
        try {
            let user = req.requestingUser!;

            let tool = await CourseStructureJSON.getUserTool(user._id, req.params.toolId);
            if (!tool) return next({ message: `not permitted to access tool: ${req.params.toolId}`, status: 401 })

            const name = sha1(user.email);
            const stringifiedAgent = JSON.stringify({
                objectType: 'Agent',
                account: {
                    homePage: 'https://bwcoretech.fokus.fraunhofer.de/app',
                    name
                }
            })

            const token = Buffer.from(`${uuid()}:${tool.lrss!.join(',')}`).toString('base64');

            const fetch =
                `${baseurl}/cmi5/authTokenGenerator/${token}`

            const endpoint =
                `${baseurl}/cmi5/data/xAPI`;



            state[token] = true;
            const lastStringified = queryString.stringify({
                endpoint,
                fetch,
                registration: tool._id,
                activityId: tool.activityId,
                actor: stringifiedAgent
            })

            return res.json({ redirect_url: `${tool.launchableUrl}?${lastStringified}` })

        } catch (err) {
            return next(err)
        }
    }

    getActivities: express.Handler = async (req, res, next) => {
        res.setHeader('access-control-expose-headers', '*');
        const lrss = res.locals.lrss;
        if (lrss.length > 0) {
            return this.lrsProxy(req, res, next, lrss, 'activities')
        } else {
            const { activityId } = req.query;
            const sample = {
                "objectType": "Activity",
                "id": activityId,
                "definition": {},
                "context": {
                    "contextActivities": {
                        "category": [
                            "https://w3id.org/xapi/cmi5/context/categories/cmi5"
                        ],
                        "grouping": [
                            "http://example.com/activities/hang-gliding-school",
                            "http://id.tincanapi.com/activity/software/scormdriver/7.7.0.a1"
                        ]
                    }
                }
            }
            return res.json(sample)
        }
    }


    getActivityState: express.Handler = async (req, res, next) => {
        const lrss = res.locals.lrss;
        res.setHeader('access-control-expose-headers', 'ETag');
        if (lrss.length > 0) {
            return this.lrsProxy(req, res, next, lrss, 'activities/state')
        } else {
            let sample;
            switch (req.query.stateId) {
                case 'LMS.LaunchData':
                    sample = {
                        "contextTemplate": {
                            "contextActivities": {
                                "grouping": {
                                    "id": "http://example.com/activities/hang-gliding-school"
                                }
                            },
                            "extensions": {
                                "https://w3id.org/xapi/cmi5/context/extensions/sessionid": "http://t1RZa11ZmyhCOLK4SbvXMnnM_wY-EWza_rise/activity"
                            }
                        },
                        "launchMode": "Normal"
                    }
                    break;
                case 'status':
                    sample = {
                        "completion": null,
                        "success": null,
                        "score": null,
                        "launchModes": ["Normal", "Normal", "Normal", "Normal", "Normal", "Normal", "Normal", "Normal", "Normal", "Normal", "Normal", "Normal", "Normal", "Normal", "Normal", "Normal", "Normal", "Normal", "Normal",
                            "Normal"
                        ]
                    }
                    break;
                case 'cumulative_time':
                    sample = 2949449;
                    break;
            }
            return res.json(sample)
        }

    }

    putActivityState: express.Handler = async (req, res, next) => {
        const lrss = res.locals.lrss;
        if (lrss.length > 0) {
            return this.lrsProxy(req, res, next, lrss, 'activities/state', 'PUT')
        } else {
            return res.status(204).send()
        }
    }


    profile: express.Handler = async (req, res, next) => {
        res.setHeader('access-control-expose-headers', 'ETag');

        const lrss = res.locals.lrss;
        if (lrss.length > 0) {
            return this.lrsProxy(req, res, next, lrss, 'agents/profile')
        } else {
            const sample = {
                "languagePreference": "en-US,fr-FR,de-DE",
                "context": {
                    "audioPreference": "off"
                }
            }
            return res.json(sample)
        }
    }

    authTokenGenerator: express.Handler = (req, res, next) => {
        delete state[req.params.id];
        return res.json({ 'auth-token': req.params.id });
    }

    tokenMW: express.Handler = async (req, res, next) => {
        try {
            const authHeader = req.get('Authorization')?.split('Basic ')[1];
            if (!authHeader) return next({ message: "Authorization header needs to be present", status: 400 })
            const lrsIds = Buffer.from(authHeader, 'base64').toString('utf-8').split(':')[1].split(',');
            res.locals.lrss = (await spBDTOInstance.findAll()).filter((lrs) => lrsIds.includes(lrs._id))
            return next();
        } catch (err) {
            console.error({ err })
            return next(err);
        }
    }

    statements: express.Handler = async (req, res, next) => {
        res.setHeader('access-control-expose-headers', 'ETag');
        const lrss = res.locals.lrss;
        if (lrss.length > 0) {
            return this.lrsProxy(req, res, next, lrss, 'statements', 'PUT')
        } else {
            return res.status(204).send()
        }
    }



    lrsProxy = async (
        req: express.Request,
        res: express.Response,
        next: express.NextFunction,
        lrss: SPModel[],
        path: string,
        method: ('PUT' | 'POST' | 'GET') = 'GET'
    ) => {
        const lrs = lrss[0];
        const token = Buffer.from(`${lrs.username}:${lrs.password}`).toString('base64');
        const query = req.originalUrl.split('?')[1]
        const redirect_url = `${lrs.baseUrl}/${path}?${query}`
        const contentType = req.get('Content-Type')
        let data = method === 'GET' ? undefined : req.body;
        let headers: { [key: string]: string } = {
            authorization: `Basic ${token}`,
            'X-Experience-API-Version': '1.0.2',
        }
        if (contentType) headers['Content-Type'] = contentType;

        return axios(
            {
                url: redirect_url,
                method,
                data,
                headers
            }
        ).then((response) => {
            const headers = response.headers;
            for (const headerKey in headers) res.setHeader(headerKey, headers[headerKey]);
            if (headers['content-type'] === 'application/json') {
                return res.json(response.data)
            } else {
                let data = response.data;
                if (typeof data === 'number') data = data.toString();
                return res.send(data)
            }
        }).catch((err) => {
            return next({ message: err?.response?.data || "error occured", status: err?.response?.status || 500 })
        })

    }



}

const controller = new Cmi5Controller()

controller.router.get('/data/xAPI/agents/profile', controller.tokenMW, controller.profile)
controller.router.get('/data/xAPI/activities/state', controller.tokenMW, controller.getActivityState)
controller.router.put('/data/xAPI/activities/state', controller.tokenMW, controller.putActivityState)
controller.router.get('/data/xAPI/activities', controller.tokenMW, controller.getActivities)
controller.router.put('/data/xAPI/statements', controller.tokenMW, controller.statements)
controller.router.post('/authTokenGenerator/:id', controller.authTokenGenerator)
controller.router.post('/:toolId', AuthGuard.requireUserAuthentication(), controller.launch)

export default controller