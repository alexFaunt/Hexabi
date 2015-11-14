import axios from 'axios';
import Promise from 'promise';

import config from '../../server-config';

function getResponseString (obj) {
    const resp = [];

    for (let prop in obj) {
        if (!obj.hasOwnProperty(prop)) {
            continue;
        }

        if (typeof(obj[prop]) === 'object') {
            resp.push(prop + ' ' + getResponseString(obj[prop]));
            continue;
        }

        resp.push(prop);
    }

    return '{ ' + resp.join(', ') + ' }';
}

export default function (opts) {

    const { type, method, params, response, token } = opts;

    let data = type + ' { ' + method + ' ';

    if (params) {
        // For each of the params
        const paramArray = [];
        for (let prop in params) {
            if (!params.hasOwnProperty(prop)) {
                continue;
            }
            paramArray.push(prop + ': "' + params[prop] + '"');
        }

        data += '( ' + paramArray.join(', ') + ' ) ';
    }

    if (response) {
        // concat all the responses through recursion
        data += getResponseString(response);
    }

    data += ' }';

    const headers = {
        'Content-Type': 'application/graphql',
    };

    console.log('API CALL', token);
    if (token) {
        headers.token = token;
    }

    // Return axios to the api end point
    return axios({
        url: 'http://localhost:' + config.port + '/api',
        method: 'post',
        headers,
        data
    });
};
