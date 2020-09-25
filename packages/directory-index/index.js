"use strict";

// Source: https://aws.amazon.com/blogs/compute/implementing-default-directory-indexes-in-amazon-s3-backed-amazon-cloudfront-origins-using-lambdaedge/
//
// Handles requests like www.myapp.com/app/ (with trailing slash) and adds index.html to them
// By default this request returns 200 OK with application/x-directory content type
const http = require("https");

exports.handler = (event, context, callback) => {
  // Extract the request from the CloudFront event that is sent to Lambda@Edge
  var request = event.Records[0].cf.request;

  // Extract the URI from the request
  var olduri = request.uri;

  // Match any '/' that occurs at the end of a URI. Replace it with a default index
  var newuri = olduri.replace(/\/$/, "/index.html");

  // Redirect form /t/ to /tracing/
  if(newuri.includes("/t/")){
    newuri = newuri.replace("/t/", "/tracing/");
  }

  // Log the URI as received by CloudFront and the new URI to be used to fetch from origin
  console.log("Old URI: " + olduri);
  console.log("New URI: " + newuri);
  // Replace the received URI with the URI that includes the index page
  request.uri = newuri;

  // Return to CloudFront
  return callback(null, request);
};
