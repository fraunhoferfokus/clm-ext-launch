**This microservice, is based upon  [clm-core](https://github.com/fraunhoferfokus/clm-core) and extends the basic functionalities with additional features**

## CLM-EXT-LAUNCH

This service is used to allow clients to execute a launch request (LTI, CMI5) and then display the content in the client system. This service can also translate between different launch specifications offered by the different tools. The groups/user assignments determine whether a content is launched for the context of a user.
## Requirements
- MariaDB, set up locally.
- Node.js 20.x

### Folder Structure
root

├── api-docs # Open API 3.0.0 definition as .yaml file documenting all routes and data models this service offers.

├── docs # Developer documentation of all functions, classes, interfaces, types this service exposes as an npm package.

├── dist # The built TypeScript project transpiled to JavaScript.

└── src # Business-relevant logic for this web server.


### Architecture
![Entit Relationship Model](assets/clm.EntityRelationshipdiagram.v1p0p0.svg)

The Entity Relationship Model of the Open Core is shown above. 

The `clm-ext-launch` module does not utilize resources on its own but leverages various resources from other modules to facilitate the launching of objects in compliance with the standard:

#### User ([clm-core](https://github.com/fraunhoferfokus/clm-core/))
- Used to enrich user information during the Launch Request.
- Checks for user-specific enrollments.

#### Enrollment ([clm-ext-learning_objects](https://github.com/fraunhoferfokus/clm-ext-learning_objects/))
- Verifies user-specific assignments in learning objects.

#### ServiceProvider ([clm-ext-service_providers](https://github.com/fraunhoferfokus/clm-ext-service_providers/))
- Required to obtain all user-specific service providers and their associated tools.

#### Tool ([clm-ext-tools](https://github.com/fraunhoferfokus/clm-ext-tools/))
- Necessary to determine the type of tool to be launched. Currently supports the launch standards CMI5, LTI 1.1, and LTI 1.3.

This service functions as a web microservice that can be orchestrated through a gateway and as an npm package to provide functionalities to other CLM extensions. A microservice can build upon the classes/types/interfaces of this service to extend basic functionalities.

## Setup for testing the webserver 

1. npm install
2. Copy .env.default to .env and overwrite needed properties

Following table gives an overview of the settings you can change through the environment variables

| Name                   | Example                                                                         | Required (Yes/No) | Description                                                                                                                                                |
| ---------------------- | ------------------------------------------------------------------------------- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PORT                   | 3002                                                                            | Yes               | The port on which the service should be deployed.                                                                                                          |
| DEPLOY_URL             | HOST_PROTOCOL://HOST_ADDRESS:GATEWAY_PORT/api                                   | Yes               | The address where all microservices are to be orchestrated. A /api must be appended.                                                                       |
| MARIA_CONFIG           | MARIA_HOST_ADDRESS\|MARIA_PORT\|MARIA_DATABASE\|MARIA_USER\|MARIA_USER_PASSWORD | Yes               | A comma-separated string that must contain the configured parameters that were previously defined during the installation of MariaDB.                      |
| TOKEN_SECRET           | `secret`                                                                        | Yes               | to sign and verify JWTs for authentication. Have to be the same across all modules of the Open-Core                                                                                                                |
| GATEWAY_URL            | http://gateway/api                                                              | No                | The URL of the application's gateway, which might be used for API routing. This is relevant when using docker orchestration. Defaults to the example value |
| LOGIN_HINT_ENCRYPT_KEY | secret                                                                          | No                | A secret key used to encrypt login hints. Relevant for LTI 1.3. Defaults to the example value                                                              |
| KID                    | 1                                                                               | No                | The key identifier for the public key to be used. For LTI 1.3 relevant. Defaults to the example value                                                      |
| `DISABLE_ERR_RESPONSE` | `true`                                                                          | No                | Flag to control whether error responses should be returned. Defaults to example value if not set.                                                          |

3.1 `npm run dev` for development with nodemon
3.2 `npm start` for deployment

## For Consumption as an NPM Package

- Documentation about all exposed modules can be found under `/docs`.
- Include the package in your project's `package.json` dependencies:

    ```json
    "dependencies": {
        "clm-ext-launch": "git+https://$token:$token@$url_of_package#$branch_name"
    }
    ```

- To use database-dependent DAOs/DTOs, inject `MARIA_CONFIG` into the environment before importing the module:

    a) Manually in the code:

    ```javascript
    process.env.MARIA_CONFIG = "localhost|3306|clm|root|12345";
    import * as core from 'clm-ext-launch';
    ```

    b) Through `.env` file:

    ```.env
    MARIA_CONFIG=localhost|3306|clm|root|12345
    ```

    ```javascript
    import * as core from 'clm-ext-launch';
    ```


# Swagger Documentation

- Accessible routes for this microservice are available at `http://localhost:PORT/launch/swagger` after starting the service.
- Ensure to set up a reverse proxy to route traffic to the respective microservices as shown in the table.

### Changelog

The changelog can be found in the [CHANGELOG.md](CHANGELOG.md) file.

## Get in touch with a developer

Please see the file [AUTHORS.md](AUTHORS.md) to get in touch with the authors of this project.
We will be happy to answer your questions at {clm@fokus.fraunhofer.de}

## License

The project is made available under the license in the file [LICENSE.txt](license.txt)


