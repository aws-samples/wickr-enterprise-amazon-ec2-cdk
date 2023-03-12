import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Port } from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam'
import { Construct } from 'constructs';
import { readFileSync } from 'fs';

export class WickrEntCdk extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Edit the parameters below to your requirements
    //
    // Set the AZ you want to use for your Messaging and Voice Instances here (Region will be taken from your profile)
    const messVoiceVidAZ = new cdk.CfnParameter(this, "messVoiceVidAZ", {
      type: "String",
      description: "The AZ used for your Messaging and VoiceVideo instances.",
      default: 'eu-west-2a'
    });
    // Set the AZ you want to use for your Compliance instance here (Region will be taken from your profile)
    const complianceAZ = new cdk.CfnParameter(this, "complianceAZ", {
      type: "String",
      description: "The AZ used for your Compliance instance.",
      default: 'eu-west-2b'
    });

    // Set this to the IP that you will allow SSH from to administer the Messaging and VoiceVideo instances
    const sshIp = new cdk.CfnParameter(this, "sshIp", {
      type: "String",
      description: "The IP that you will administer the instances from via SSH.",
    });

    // Set this to the name of the keypair you have uploaded to your region
    const keyPair = new cdk.CfnParameter(this, "keyPair", {
    type: "String",
    description: "The keypair that you will use for SSH into your instances.",
    });

    // Set the root volume EBS size for the three servers (min 120G)
    const EBSsize = new cdk.CfnParameter(this, "EBSsize", {
    type: "Number",
    description: "The size in GB of the instances (120G minimum required).",
    default: 120
    });
    //
    //
    
    // Set the Complaince Server User-Data (/src/config.sh)
    let complianceUserData = readFileSync('./src/compliance-config.sh', 'utf8');
    // Set the Messaging Server User-Data (/src/config.sh)
    let messagingUserData = readFileSync('./src/messaging-config.sh', 'utf8');
    // Set the Messaging Server User-Data (/src/config.sh)
    let voicevideoUserData = readFileSync('./src/voicevideo-config.sh', 'utf8');

    // Set up VPC, 2 x Public and 2 x Private subnets in your default region. NAT gateway and routing etc created.
    const vpc = new ec2.Vpc(this, 'VPC', {
      availabilityZones: [messVoiceVidAZ.valueAsString, complianceAZ.valueAsString]
    });

    // EC2 role for SSM to connect
    const role = new iam.Role(this, 'ec2Role', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com')
    });

    // Add managed policy to role
    role.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'));

    // Create Security Group for the Compliance Ec2
    const complianceSecurityGroup = new ec2.SecurityGroup(this, 'Compliance Security Group', {
      vpc,
      description: 'Ingress rules required for Wickr Compliance Server',
      securityGroupName: 'Compliance Ingress',
      allowAllOutbound: true
    });

    // Create Security Group for the Messaging Ec2
    const messagingSecurityGroup = new ec2.SecurityGroup(this, 'Messaging Security Group', {
      vpc,
      description: 'Ingress rules required for Wickr Messaging Server',
      securityGroupName: 'Messaging Ingress',
      allowAllOutbound: true
    });

    // Create Security Group for the Voice and Video Ec2
    const voicevideoSecurityGroup = new ec2.SecurityGroup(this, 'Voice and Video Security Group', {
      vpc,
      description: 'Ingress rules required for Wickr Voice and Video Server',
      securityGroupName: 'Voice and Video Ingress',
      allowAllOutbound: true
    });

    // Create new EIP's for the servers
    let messagingEip = new ec2.CfnEIP(this, "Messaging EIP");
    let voiceviceoEip = new ec2.CfnEIP(this, "VoiceViceo EIP");

    // Use Latest Amazon Linux Image - CPU Type ARM64
    const ami = new ec2.AmazonLinuxImage({
      generation: ec2.AmazonLinuxGeneration.AMAZON_LINUX_2,
      cpuType: ec2.AmazonLinuxCpuType.X86_64
    });




    // Compliance EC2 instance
    const complianceEc2Instance = new ec2.Instance(this, 'Retention', {
      vpc,
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.LARGE),
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_NAT,
        availabilityZones: [complianceAZ.valueAsString]
      },
      machineImage: ami,
      blockDevices: [
        {deviceName: '/dev/xvda',
        volume: ec2.BlockDeviceVolume.ebs(EBSsize.valueAsNumber, {
          deleteOnTermination: true,
          encrypted: true
        }),
        }
      ],
      securityGroup: complianceSecurityGroup,
      keyName: keyPair.valueAsString,
      role: role,
    });
    // Add userdata
    complianceEc2Instance.addUserData(complianceUserData);




    // Messaging EC2 instance
    const messagingEc2Instance = new ec2.Instance(this, 'Messaging', {
      vpc,
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.LARGE),
      vpcSubnets: {
        subnetType: ec2.SubnetType.PUBLIC,
        availabilityZones: [messVoiceVidAZ.valueAsString]
      },
      machineImage: ami,
      blockDevices: [
        {deviceName: '/dev/xvda',
        volume: ec2.BlockDeviceVolume.ebs(EBSsize.valueAsNumber, {
          deleteOnTermination: true,
          encrypted: true
        }),
        }
      ],
      securityGroup: messagingSecurityGroup,
      keyName: keyPair.valueAsString,
      role: role
    });
    //Add userdata
    messagingEc2Instance.addUserData(messagingUserData);
    // Associate EIP
    let messagingEc2assoc = new ec2.CfnEIPAssociation(this, "Messaging Ec2 EIP Association", {
      eip: messagingEip.ref,
      instanceId: messagingEc2Instance.instanceId
    });

    // Messaging Server Security Group Ingress Rules
    messagingSecurityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(22), 'SSH Access');
    messagingSecurityGroup.addIngressRule(ec2.Peer.ipv4(sshIp.valueAsString), ec2.Port.tcp(8800), 'Installer UI Admin Console');
    messagingSecurityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(443), 'Client');
    messagingSecurityGroup.connections.allowFrom(voicevideoSecurityGroup, Port.tcpRange(9870, 9881), 'Voice and Video');
    messagingSecurityGroup.connections.allowFrom(complianceSecurityGroup, Port.tcp(443), 'Compliance Server');



    // Voice and Video EC2 instance
    const voicevideoEc2Instance = new ec2.Instance(this, 'VoiceVideo', {
      vpc,
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.LARGE),
      vpcSubnets: {
        subnetType: ec2.SubnetType.PUBLIC,
        availabilityZones: [messVoiceVidAZ.valueAsString]
      },
      machineImage: ami,
      blockDevices: [
        {deviceName: '/dev/xvda',
        volume: ec2.BlockDeviceVolume.ebs(EBSsize.valueAsNumber, {
          deleteOnTermination: true,
          encrypted: true
        }),
        }
      ],
      securityGroup: voicevideoSecurityGroup,
      keyName: keyPair.valueAsString,
      role: role
    });
    // Add userdata
    voicevideoEc2Instance.addUserData(voicevideoUserData);
    // Associate EIP
    let voicevideoEc2assoc = new ec2.CfnEIPAssociation(this, "Voicevideo Ec2 EIP Association", {
      eip: voiceviceoEip.ref,
      instanceId: voicevideoEc2Instance.instanceId
    });

    // Voicevideo Server Security Group Ingress Rules
    voicevideoSecurityGroup.addIngressRule(ec2.Peer.ipv4(sshIp.valueAsString), ec2.Port.tcp(22), 'Allow SSH Access'),
    voicevideoSecurityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.udpRange(16384, 17384), 'Audio and Video');
    voicevideoSecurityGroup.connections.allowFrom(messagingSecurityGroup, Port.tcp(444), 'Messaging Server');
    voicevideoSecurityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(8001), 'SOCKS Proxy');
    voicevideoSecurityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(443), 'TCP Proxy');



    new cdk.CfnOutput(this, 'Compliance Private IP (use SSM Session Manager/SSM SSH for access', { value: complianceEc2Instance.instanceId });
    new cdk.CfnOutput(this, 'Messaging Public IP', { value: messagingEc2Instance.instancePublicIp });
    new cdk.CfnOutput(this, 'Voice & Video Public IP', { value: voicevideoEc2Instance.instancePublicIp });
  }
}
