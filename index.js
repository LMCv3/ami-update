/**
 * Takes a server image, infers the autoscalers and target groups associated and updates all the things for you
 * Usage: index.js [<ip-address>] [-r <region>] [-i <ip-address>] [-g <scaling-group-name>]
 */
const AWS = require('aws-sdk');
const program = require('commander');
const inquirer = require('inquirer');
const waitUntil = require('wait-until');
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
	.then(async answers => {
		region = answers.region;

		if (!program.group){
			// Get the names of the AutoScaling Groups in this region
			const autoscaling = new AWS.AutoScaling({region: region, apiVersion: '2011-01-01'});
			autoscaling.describeAutoScalingGroups({}, async function(err, data) {
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
					]).then(async answers => {
						const ec2 = new AWS.EC2({region: region, apiVersion: '2016-11-15'});
						let oldLaunchConfig = '';
						let targetGroupARN = '';
						let instances = [];
						let startingMin = 0;
						// Get the Current Launch Config
						autoscaling.describeAutoScalingGroups({AutoScalingGroupNames: [ answers.asgroup ]}, async function(err, data) {
							if (err) {
								console.error(err,err.stack);
								process.exit(1);
							} else {
								// Get the TargetGroup Name
								oldLaunchConfig = data.AutoScalingGroups[0].LaunchConfigurationName;
								instances = data.AutoScalingGroups[0].Instances;
								startingMin = data.AutoScalingGroups[0].MinSize;
								AMImaster = '';
								// Pick new TargetGroup & AMI Names
								let questions = [
									{
										type: 'input',
										name: 'newLaunchConfig',
										message: 'Launch Config Name (previous: ' + oldLaunchConfig + '):'
									},
									{
										type: 'input',
										name: 'newAMI',
										message: 'AMI name:'
									},
									{
										type: 'input',
										name: 'amiDescription',
										message: 'AMI Description:'
									}
								];
								if (startingMin >= 2) {
									// which instance should we use?
									let instanceChoices = [];
									for (const instance of instances) {
										instanceChoices.push(instance.InstanceId);
									}
									questions.push({
										type: 'list',
										name: 'instanceid',
										message: 'Which Instance should we image for scaling?',
										choices: instanceChoices
									})
								}
								inquirer.prompt(questions).then(async answers => {
									const newLaunchConfig = answers.newLaunchConfig;
									const newAMIname = answers.newAMI;
									const newAMIdescription = answers.amiDescription;
									const asGroupName = data.AutoScalingGroups[0].AutoScalingGroupName;
									if (startingMin < 2) {
										AMImaster = instances[0].InstanceId
									} else {
										AMImaster = answers.instanceid;
									}
									console.log('Ready to reimage by:');
									console.log('Make new AMI ('+ newAMIname+', '+newAMIdescription+') of instance ' + AMImaster);
									console.log('Make a new Launch Config ('+newLaunchConfig+') from old config '+oldLaunchConfig);
									console.log('Then updating AutoScalingGroup ' + asGroupName);
									console.log('And shutting down old images');
									inquirer.prompt([{
										type: 'confirm',
										name: 'readySetGO',
										message: 'Are you ready to continue?',
										deafult: false
									}]).then(async answers => {
										if (!answers.readySetGO){
											console.log('Exiting...');
											process.exit();
										}
										if (startingMin < 2) {
											console.log('Adding scale...');
											// change AS Group Min to 2
											// wait until instances with LifecycleState = InService are at least 2 before proceeding
											await scaleToTwo(data.AutoScalingGroups[0]);
										}
										var imgParams = {
											BlockDeviceMappings: [
												{
													DeviceName: "/dev/xvda",
													Ebs: {
														VolumeSize: 8
													}
												}
											],
											Name: newAMIname,
											Description: newAMIdescription,
											InstanceId: AMImaster,
											NoReboot: false
										}
										console.log('Creating image from ' + AMImaster);
										ec2.createImage(imgParams, function(err, data) {
											if (err) {
												console.error(err, err.stack);
												process.exit();
											} else {
												let newAMI = data.ImageId;
												console.log('New Image ID: ' + newAMI);
												autoscaling.describeLaunchConfigurations({LaunchConfigurationNames: [ oldLaunchConfig ]}, function(err, data){
													if (err) {
														console.error(err, err.stack);
														process.exit();
													} else {
														// Build new Launch config from old Launch Config Params
														let launchConfig = data.LaunchConfigurations[0];
														launchConfig.LaunchConfigurationName = newLaunchConfig;
														launchConfig.ImageId = newAMI;
														console.log('Creating Launch Config...');
														autoscaling.createLaunchConfiguration(launchConfig, function(err, data){
															if (err) {
																console.error(err, err.stack);
																process.exit();
															} else {
																console.log('Created ', data);
																// Swap the Launch Config in the AutoScaling Group
																let asParams = {
																	AutoScalingGroupName: asGroupName,
																	LaunchConfigurationName: data
																}
																autoscaling.updateAutoScalingGroup(asParams, async function(err,data){
																	if (err) {
																		console.error(err, err.stack);
																		process.exit();
																	} else {
																		console.log('Updated AutoScaling Group ' + asGroupName + ' Successfully' );
																	}
																})
															}
														})
													}
												})
												// Wait for image to finish
												// Shut down old images, one at a time
												// (if applicable) drop minsize back down to original value
											}
										})
									});
								});
								// (Be sure to tag "client" on both AMI and Snapshot)
							}
						});
					});
				}
			})
			
		}
	});
} else {
	region = program.region;
}
/**
 * For an AutoScaling Group, adjusts the "min" (and "desired," if necessary) to 2.
 * @param  object 	asGroup 	the AutoScalingGroup Object as returned by describeAutoScalingGroups
 * @return Promise	bool		True / resolve or false / reject when the scaling has finished
 */
async function scaleToTwo(asGroup){
	// adjust the ASGroup min to 2
	
	console.log('Scaling '+ asGroup.AutoScalingGroupName + ' to 2...');
	const autoscaling = new AWS.AutoScaling({region: region, apiVersion: '2011-01-01'});
	var desired = 0;
	return new Promise(function(resolve,reject){
		autoscaling.describeAutoScalingGroups({AutoScalingGroupNames: [asGroup.AutoScalingGroupName]}, function (err, data) {
			if (err) {
				console.error(err);
				reject(err);
				process.exit();
			} else {
				desired = data.AutoScalingGroups[0].DesiredCapacity;
				return resolve(desired);
			}
		});
	}).then(function(result){
		if (result < 2){
			console.log('Increasing Desired Capacity to 2...');
			autoscaling.setDesiredCapacity({
				AutoScalingGroupName: asGroup.AutoScalingGroupName,
				DesiredCapacity: 2,
				HonorCooldown: false
			}, function(err, data) {
				if (err) {
					console.error(err);
					reject(err);
					process.exit();
				} else {
					resolve(true);
				}
			});
		}
	}).then(function(result){
		console.log('Increasing MinSize to 2...');
		autoscaling.updateAutoScalingGroup({
			AutoScalingGroupName: asGroup.AutoScalingGroupName,
			MinSize: 2
		}, function (err, data) {
			console.log('Line 264');
			if (err) {
				console.log(err);
				reject(err);
				process.exit();
			} else {
				console.log('Waiting for Scaling to complete...');
				waitUntil().interval(1000*30).times(60).condition(async function(){
					console.log('Checking...');
					let inService = await howManyInService(asGroup.AutoScalingGroupName);
					if (inService >= 2) {
						console.log('Yep ',inService);
						return true;
					} else {
						console.log("Nope ",inService);
						return false;
					}
				}).done(function(result){
					console.log(asGroup.AutoScalingGroupName + ' now has at least 2 instances in service.');
					resolve(true);
				});
			}
		});		
	})
	
}
/**
 * Checks an AutoScaling Group's instances and returns how many are "in service"
 * @param 	string	asGroup 	the AutoScalingGroup Name, from the Object: asGroup.AutoScalingGroupName
 * @return 	int        			Number of instances "In Service" assigned to the AutoScaling Group
 */
async function howManyInService(asGroup){
	console.log('checking ' + asGroup);
	const autoscaling = new AWS.AutoScaling({region: region, apiVersion: '2011-01-01'});
	return new Promise(function(resolve,reject){
		autoscaling.describeAutoScalingGroups({AutoScalingGroupNames: [asGroup]}, async function (err, data) {
			if (err) reject(err);
			const dataset = data.AutoScalingGroups[0].Instances;
			let num = [];
			console.log(dataset);
			for (const instance of dataset) {
				if (instance.LifecycleState == 'InService') {
					num.push(instance);
				}
			}
			console.log('Found '+ num.length+' InService instances');
			inService = num.length;
			resolve(num.length);
		});
	});
}
// Swap out the Launch Config on the AS Group
// Once the AMI is finished
// Clear out servers until all servers are from the new AMI
// all done!
