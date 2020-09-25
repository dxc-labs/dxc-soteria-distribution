'use strict';

// Source - https://andrewlock.net/using-lambda-at-edge-to-handle-angular-client-side-routing-with-s3-and-cloudfront/

const http = require('https');

const indexPage = 'index.html';

exports.handler = async (event, context, callback) => {
    const cf = event.Records[0].cf;
    const request = cf.request;
    const response = cf.response;
    const statusCode = response.status;

    // Only replace 403 and 404 requests typically received
    // when loading a page for a SPA that uses client-side routing
    const doReplace = request.method === 'GET'
                    && (statusCode == '403' || statusCode == '404');

    const result = doReplace 
        ? await generateResponseAndLog(cf, request, indexPage, response)
        : response;

    callback(null, result);
};

async function generateResponseAndLog(cf, request, indexPage, originalResponse){

    const domain = cf.config.distributionDomainName;
    const appPath = getAppPath(request.uri);

    const indexPath = `/${appPath}/${indexPage}`;

    const response = await generateResponse(domain, indexPath, request, originalResponse);
    // console.log('response: ' + JSON.stringify(response));
    return response;
}

async function generateResponse(domain, path, request, originalResponse){
    try {
        // Load HTML index from the CloudFront cache
        const s3Response = await httpGet({ hostname: domain, path: path });

        const headers = s3Response.headers || 
            {
                'content-type': [{ value: 'text/html;charset=UTF-8' }]
            };

        const responseHeaders = wrapAndFilterHeaders(headers, originalResponse.headers || {})

        // Debug headers to see the original requested URL vs the index file request.
        // responseHeaders['x-lambda-request-uri'] = [{value: request.uri}]
        // responseHeaders['x-lambda-hostname'] = [{value: domain}]
        // responseHeaders['x-lambda-path'] = [{value: path}]
        // responseHeaders['x-lambda-response-status'] = [{value: String(s3Response.status)}]

        return {
            status: '200',
            headers: responseHeaders,
            body: s3Response.body
        };
    } catch (error) {
        console.log(error)
        return {
            status: '500',
            headers:{
                'content-type': [{ value: 'text/plain' }]
            },
            body: 'An error occurred loading the page'
        };
    }
}

function httpGet(params) {
    return new Promise((resolve, reject) => {
        http.get(params, (resp) => {
            console.log(`Fetching ${params.hostname}${params.path}, status code : ${resp.statusCode}`);
            let result = {
                status: resp.statusCode,
                headers: resp.headers,
                body: ''
            };
            resp.on('data', (chunk) => { result.body += chunk; });
            resp.on('end', () => { resolve(result); });
        }).on('error', (err) => {
            console.log(`Couldn't fetch ${params.hostname}${params.path} : ${err.message}`);
            reject(err, null);
        });
    });
}

// Get the app path segment e.g. candidates.app, employers.client etc
function getAppPath(path){
    if(!path){
        return '';
    }

    if(path[0] === '/'){
        path = path.slice(1);
    }

    const segments = path.split('/');

    // will always have at least one segment (may be empty)
    return segments[0];
}

// Cloudfront requires header values to be wrapped in an array
function wrapAndFilterHeaders(headers, originalHeaders){
    const allowedHeaders = [
        'content-type',
        'content-length',
        'last-modified',
        'date',
        'etag'
    ];

    const responseHeaders = originalHeaders;

    if(!headers){
        return responseHeaders;
    }

    for(var propName in headers) {
        // only include allowed headers
        if(allowedHeaders.includes(propName.toLowerCase())){
            var header = headers[propName];

            if (Array.isArray(header)){
                // assume already 'wrapped' format
                responseHeaders[propName] = header;
            } else {
                // fix to required format
                responseHeaders[propName] = [{ value: header }];
            }    
        }

    }

    return responseHeaders;
}