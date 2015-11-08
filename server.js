// set up config
import config from './server-config.js';

// Standard imports
import express from 'express';
import fs from 'fs';
import path from 'path';

// Routes
import routes from './app/routes';
import { match, RoutingContext } from 'react-router';
import { createLocation } from 'history';
import storeFactory from './app/factories/store';

// Rendering
import React from 'react';
import ReactDOMServer from 'react-dom/server';

// Flux stuff
import { createStore, combineReducers, applyMiddleware } from 'redux';
import { Provider } from 'react-redux';
import * as reducers from './app/reducers';
import api from 'app/middleware/api';
import fetchComponentData from 'app/core/lib/fetchComponentData';

// Api
import { graphql } from 'graphql';
import bodyParser from 'body-parser';
import schema from './api/schema';

// Auth
import cookieParser from 'cookie-parser';
import jwtToken from 'jsonwebtoken';

// Get the HTML file to dump content into
const htmlFile = fs.readFileSync(path.join(__dirname, './app/index.html'), {encoding: 'utf-8'});

// Function defs
function createApp () {
    return express();
}

// start the app
function run () {

    // Create app
    const app = createApp();

    // Static assets
    app.use('/static', express.static(path.join(__dirname, './static')));
    app.use('/build', express.static(path.join(__dirname, './build')));
    function fromHeaderOrQuerystring (req) {
        return null;
    };
    // parse POST body as text
    app.use(
        '/api',
        cookieParser(),
        bodyParser.text({ type: 'application/graphql' }),
        function (req, res, next) {
            let token = null;
            if (req.cookies.token) {
                token = req.cookies.token;
            }
            if (req.headers.token) {
                token = req.headers.token;
            }
            if (token === null) {
                return res.status(401).send('fuck off chump');
            }
            // TODO - TEST UNVERIFIED TOKEN
            const decoded = jwtToken.verify(token, config.auth.secret);
            // TODO - check it?
            req.member = decoded;
            return next();
        }
    );

    // Api
    app.post('/api',
        function (req, res) {
            console.log(req.member);

            // execute GraphQL!
            graphql(schema, req.body)
                .then(function (result) {
                    res.status(200).send(JSON.stringify(result.data, null, 2));
                })
                .catch(function (err) {
                    console.error(err);
                    res.status(500).send(err.message);
                });
        });

    // Auth
    function generateToken(username, password) {
        const payload = { username, password };
        return jwtToken.sign(payload, config.auth.secret);
        // , {
        //     expiresInMinutes: config.auth.expires // TODO - this
        // }
    }

    // TODO - LOGOUT
    app.use('/auth/login', bodyParser.json());
    app.post('/auth/login', function (req, res) {

        // TODO check if it's a good login
        if (req.body.username !== "alex" || req.body.password !== "pass") {
            console.log('NO AUTHED', req.body.username, req.body.password);
            return res.status(200).send(JSON.stringify({result: 'failure'}));
        }

        // make a token
        const token = generateToken(req.body.username, req.body.password);

        const id = '1';

        // Get a graphql
        graphql(schema, 'query { member (id: "' + id + '") { id, name } }')
            .then(function (response) {
                // Check against DB
                res.status(200)
                    .cookie('token', token)
                    .send(JSON.stringify({
                        result: 'success',
                        member: response.data.member,
                        token
                    }, null, 2));
            })
            .catch(function (err) {
                res.status(500).send(err.message);
            });

    });

    // Everything else - check against the react router + return it server rendered.
    app.get('*', cookieParser(), function (req, res) {

        const location = createLocation(req.url);

        match({ routes, location }, function (error, redirectLocation, renderProps) {

            if (error) {
                console.log('errrorororororor');
                console.log(error);
                return res.status(500).send(error.message);
            }

            if (redirectLocation) {
                return res.redirect(302, redirectLocation.pathname + redirectLocation.search);
            }

            if (!renderProps) {
                return res.status(404).send('Not found');
            }

            if (location.pathname !== '/login/' && !req.cookies.token) {
                return res.redirect(302, '/login/');
            }

            if (location.pathname === '/login/' && req.cookies.token) {
                return res.redirect(302, '/');
            }

            const reducer = combineReducers(reducers);

            // Given the cookies - i need to populate the session store
            // Then redirect if needed when no token
            // Or continue, but now the Session Store has the logged in token
            // req.cookies.token
            const store = storeFactory(reducer);

            // I'm very sorry for this. But I have no idea how to do this cleanly.
            store.getState().Session.token = req.cookies.token;

            // Closure gives it store + renderProps
            function getPayload () {
                let payload = htmlFile;

                const app = ReactDOMServer.renderToString(
                    <Provider store={store}>
                        <RoutingContext {...renderProps} />
                    </Provider>
                );

                // Put in the content
                payload = payload.replace(/__content__/,  app);

                // Put in the initial state
                payload = payload.replace(/__state__/, JSON.stringify(store.getState()));

                return payload;
            }

            fetchComponentData(store.dispatch, renderProps.components, renderProps.params)
                .then(getPayload)
                .then(html => res.status(200).end(html))
                .catch(err => res.status(500).end(err.message));
        });

    });

    // Listen
    app.listen(config.port);
    console.log('SERVER IS LISTENING O_O');
}

// Run
if (require.main === module) {
    run();
}
