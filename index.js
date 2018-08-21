/**
 * Takes a server image, infers the autoscalers and target groups associated and updates all the things for you
 * Usage: index.js [<ip-address>] [-r <region>] [-i <ip-address>] [-g <scaling-group-name>]
 */
const AWS = require('aws-sdk');
const program = require('commander');
const inquirer = require('inquirer');
let region = 'us-east-1';

// Get our variables / flags in order, ask if needed
program
	.version('1.0.0')
	.option('-i, --ip-address', 'Source Instance IP')
	.option('-r, --region', 'AWS Region')
	.option('-g, --group', 'AutoScaling Group Name')
	.parse(process.argv);
if (!program.region){
	inquirer.prompt([
	{
		type: 'list',
		name: 'region',
		message: 'Which region shall we use?',
		choices: [
			'us-east-1',
			'us-east-2',
			'us-west-1',
			'us-west-2',
			'ap-south-1',
			'ap-northeast-1',
			'ap-northeast-2',
			'ap-southeast-1',
			'ap-southeast-2',
			'ca-central-1',
			'eu-central-1',
			'eu-west-1',
			'eu-west-2',
			'eu-west-3',
			'sa-east-1'
		]
	}
	])
	.then(answers => {
		region = answers.region;

		if (!program.group){
			// Get the names of the AutoScaling Groups in this region
			const autoscaling = new AWS.AutoScaling({region: region, apiVersion: '2011-01-01'});
			autoscaling.describeAutoScalingGroups({}, function(err, data) {
				if (err){
					console.error(err, err.stack);
					console.error('Please check your AWS Credentials are set!');
					process.exit(1);
				} else {
					let asGroups = [];
					for (const group of data.AutoScalingGroups) {
						asGroups.push(group.AutoScalingGroupName);
					}
					inquirer.prompt([
						{
							type: 'list',
							name: 'asgroup',
							message: 'Choose the AutoScaling Group to update',
							choices: asGroups
						}
					]).then(answers => {
						const ec2 = new AWS.EC2({region: region, apiVersion: '2016-11-15'});
						// Get the Current Launch Config
						// Get the TargetGroup Name
						// Pick a server to use for the AMI
					});
				}
			})
			
		}
	});
} else {
	region = program.region;
}


// Scale up, if needed
// Maybe apt-get update && apt-get upgrade?
// Make the AMI
// Make the Launch Config
// Swap out the Launch Config on the AS Group
// Once the AMI is finished
// Clear out servers until all servers are from the new AMI
// all done!