![architecture](assets/images/architecture.png?raw=true)

#  Wickr Enterprise Deployment to Amazon EC2 using CDK

This will deploy the infrastructure required to run Wickr Enterprise using Amazon EC2. At a high level, this is what you will get;

- A VPC spanning 2 x AZs, with 2 x Public and 2 x Private Subnets as well as NAT Gateways and appropriate routing.
- Security groups configured as-per the Wickr Enterprise installation guide.
- 1 x Messaging, 1 x Voice and Video and 1 x Data Retention EC2 Nitro System based instances, with encrypted EBS storage and Docker CE pre-installed.
- Messaging and Voice Video servers in public subnets.
- Data Retention server in a private subnet, and in a different AZ to the other instances.

# Prerequisites

1. Carry out the CDK Prerequisites found [here](https://docs.aws.amazon.com/cdk/v2/guide/getting_started.html#getting_started_prerequisites)
2. [Install CDK](https://docs.aws.amazon.com/cdk/v2/guide/getting_started.html#getting_started_install)
3. An SSH KeyPair uploaded or created in AWS region you wish to use
4. A Wickr Enterprise license (for system configuration once this template has been deployed).

# Deployment Instructions 

1. Edit `/lib/WickrEntCdk.ts` lines 18 and 24 to reflect the AZ's you wish to use. 
2. Edit `/bin/WickrEntCdk.ts`line 18 to reflect the account and region you are deploying to.
3. Run `npm install`.
4. Bootstrap your account by running the following command, adding in your account and region; `cdk bootstrap aws://account/region`
5. Run `cdk deploy --parameters sshIp=1.2.3.4/32 --parameters keyPair=ssh_keypair_name` to deploy the stack, where `sshIp` is your public IP and `ssh_keypair_name` is your pre-existing SSH KeyPair name.
6. Once the deployment finishes, you will see the public IP's of the Messaging and Voice server as output as well as the instance id of the retention server. You can connect to that via SSM Session Manager, or by using SSM SSH (instructions [here](https://docs.aws.amazon.com/systems-manager/latest/userguide/session-manager-getting-started-enable-ssh-connections.html)
7. SSH to the Messaging server `ssh ec2-user@<messaging-server-Ip>`
8. Enter the following command:
```bash
curl -sSL -o install.sh https://get.replicated.com/docker/wickrenterprise/stable && sudo bash ./install.sh
```
9. You will now be asked to select which network addresses are attached to the server:
    - Select **[0]** to set **Eth0** as the Private IP.
    - Select **[0]** to select the **Default** for the Public IP.
    - Select **'N'** when asked if the machine requires a proxy.
10. The installation script will now complete its tasks and present you with a URL to connect to the messaging server with. 
11. Continue using the Wickr Enterprise Installation guide, as found in the `administration-guides` folder from **section 4.3**. The SSO and Installation guides are also added for your reference.

# Cleanup 

1. Run `cdk destroy`

## Useful commands

* `cdk deploy`      deploy this stack to your default AWS account/region
* `cdk diff`        compare deployed stack with current state
* `cdk synth`       emits the synthesized CloudFormation template
