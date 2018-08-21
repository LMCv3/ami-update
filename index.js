/**
 * Takes a server image, infers the autoscalers and target groups associated and updates all the things for you
 * Usage: index.js [<ip-address>] [-r <region>] [-i <ip-address>] [-g <scaling-group-name>]
 */
var AWS = require('aws-sdk');
var region = 'us-east-1';
const args = require('optimist').argv;

// Get our variables / flags in order, ask if needed
var ec2 = new AWS.EC2({region: region, apiVersion: '2016-11-15'});

// Make sure we have legit creds available to us
ec2.describeAvailabilityZones({}, function(err, data){
	if (err) {
		console.log('Please check your AWS Credentials are set according to https://docs.aws.amazon.com/sdk-for-javascript/v2/developer-guide/loading-node-credentials-shared.html');
		process.exit(1);
	} else {
		console.log(data);
	}
})
// Make sure our creds access all the things we need to access
// Which AutoScaling Group we talkin' bout here?
// Which Target Group we talkin' bout here?
// Pick a server to use for the AMI
// Pick a Launch Config to clone
// Scale up, if needed
// Maybe apt-get update && apt-get upgrade?
// Make the AMI
// Make the Launch Config
// Swap out the Launch Config on the AS Group
// Once the AMI is finished
// Clear out servers until all servers are from the new AMI
// all done!