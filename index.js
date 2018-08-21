/**
 * Takes a server image, infers the autoscalers and target groups associated and updates all the things for you
 * Usage: index.js <ip-address> | index.js -i <ip-address> | index.js -g <scaling-group-name>
 */
var AWS = require('aws-sdk');
var ec2 = new AWS.EC2();

// Get our variables / flags in order
// Make sure we have legits creds available to us
// Make sure our creds access all the things we need to access
// Which AutoScaling Group we talkin' bout here?
// Which Target Group we talkin' bout here?
// Pick a server to use for the AMI
// Pick a Launch Config to clone
// Scale up, if needed
// Make the AMI
// Make the Launch Config
// Swap out the Launch Config on the AS Group
// Once the AMI is finished
// Clear out servers until all servers are from the new AMI
// all done!