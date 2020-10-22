var noble = require('@abandonware/noble');
const fs = require('fs');

process.on('SIGINT', function() {
	process.exit();
});

process.stdin.on('data', function(data) {
	var cmd = data.toString();
	cmd = cmd.substr(0, cmd.length-1);
	console.error('add cmd', cmd, 'que', command_que, 'wating_for_response', wating_for_response);
        execute_command(cmd);
});

process.setMaxListeners(265);

//var DEBUG = false;

var Service = [
 'fff0'//carista
];

var command_que = [];
var wating_for_response = false;
var reciving_response = '';
var last_command = {cmd:'', callback:null};

var ELM_answer_timeout = 5000;//5 seconds
function ELM327_not_answering_in_time(){
	console.error("ELM327 not answering in time it might be excpecting more input. Reseting the line.")
	send_data_to_car(Buffer.from("\r", 'utf8'))
	wating_for_response = false;
}
function send_command(cmd){
	wating_for_response = setTimeout(ELM327_not_answering_in_time, ELM_answer_timeout);
	send_data_to_car(Buffer.from(cmd+"\r", 'utf8'))
}
function try_send_command_from_que(){
	if(!wating_for_response && command_que.length != 0){
		last_command = command_que.shift();
		send_command(last_command.cmd);
	}
}

function execute_command(cmd, callback){
	if(typeof(callback) == 'undefined'){
		callback = null;
	}
	command_que.push({cmd:cmd, callback:callback});
	try_send_command_from_que();
}
/*
https://i-wiki.ru/?post=vw-transport-protocol-20-tp-20-for-can-bus
The channel setup type has a fixed length of 7 bytes. It is used to establish a data channel between two modules.
The channel setup request message should be sent from CAN ID 0x200 and the response will sent with CAN ID 0x200 + the destination modules logical address e.g. for the engine control unit (0x01) the response would be 0x201.
The communication then switches to using the CAN IDs which were negotiated during channel setup.
You should request the destination module to transmit using CAN ID 0x300 to 0x310 and set the validity nibble for RX ID to invalid. The VW modules seem to respond that you should transmit using CAN ID 0x740.
*/

var TP20_opcodes = {
	Setup_request:'C0',
	Positive_response: 'D0',
	Negative_response1: 'D6',
	Negative_response2: 'D7',
	Negative_response3: 'D8',
	Broadcast_request: '23',
	Broadcast_response: '24',
	Parameters_request: 'A0',//used for destination module to initiator (6 byte)
	Parameters_respsonse: 'A1',//used for initiator to destination module (6 byte)
	Channel_test : 'A3',//response is same as parameters response. Used to keep channel alive. (1 byte)
	Break: 'A4',//receiver discards all data since last ACK (1 byte)
	Disconnect: 'A8',// channel is no longer open. Receiver should reply with a disconnect (1 byte)

	Waiting_for_ACK_more_packets_to_follow: '00',//more packets to follow (i.e. reached max block size value as specified above)
	Waiting_for_ACK_this_is_last_packet: '01',
	Not_waiting_for_ACK_more_packets_to_follow: '02',
	Not_waiting_for_ACK_this_is_last_packet: '03',
	ACK_ready_for_next_packet: '0B',
	ACK_not_ready_for_next_packet: '09'
	
};
function op_is_data(op){
	if(op == TP20_opcodes.Waiting_for_ACK_more_packets_to_follow 
		|| op == TP20_opcodes.Waiting_for_ACK_this_is_last_packet
		|| op == TP20_opcodes.Not_waiting_for_ACK_more_packets_to_follow
		|| op == TP20_opcodes.Not_waiting_for_ACK_this_is_last_packet
		){
		return true
	}
	return false
}

function TP20_opcode_separation(byte){
	return({op:'0'+byte.substr(0,1),seq:parseInt(byte.substr(1,1), 16)})
}

function hexstr(nr){
	st = nr.toString(16).toUpperCase()
	if(nr<16){
		st = '0'+st;
	}
	return st;
}
function TP20_line_cleanup(lines){
	TP20Data = [];
	for(x in lines){
		bytes = lines[x].split(' ');
		from_address = bytes.shift()
		nr_bytes = bytes.shift()
		if(bytes[bytes.length-1] == ''){
			bytes.pop();
		}
		TP20Data.push(bytes)
	}
	return TP20Data;
}
function expected_seq(cur_seq){
	str = (cur_seq+1).toString(16).toUpperCase();
	if(str.length > 1){
		return '0';
	}
	return str;
}
function interpret_TP20_incoming(lines, when_done, previus_data){
	if(typeof(previus_data) == 'undefined'){
		previus_data = [];
	}
	WeHaveTheMassage = false;
	TP20response = TP20_line_cleanup(lines);
	for(x in TP20response){
		opcode_byte = TP20response[x].shift();
		opcode_dat = TP20_opcode_separation(opcode_byte)
		
		previus_data = previus_data.concat(TP20response[x]);
		if(opcode_dat.op == TP20_opcodes.Waiting_for_ACK_this_is_last_packet){
			execute_command("B"+expected_seq(opcode_dat.seq));
			WeHaveTheMassage = true;
		}
		if(opcode_dat.op == TP20_opcodes.Not_waiting_for_ACK_this_is_last_packet){
			WeHaveTheMassage = true;
		}
		if(opcode_dat.op == TP20_opcodes.Waiting_for_ACK_more_packets_to_follow){
			//request more data by sending ACK
			execute_command("B"+expected_seq(opcode_dat.seq), function(moredata){
				interpret_TP20_incoming(moredata, when_done, previus_data);
			});
		}
	}
	if(WeHaveTheMassage){

		//TODO validate length
		len1 = previus_data.shift()
		len2 = previus_data.shift()
			
		when_done(previus_data);
	}

}
TP_send_seq = 0;

function SendTPData(data, callback){
	execute_command("1"+TP_send_seq.toString(16).toUpperCase()+" 00 "+hexstr(data.length)+" "+data.join(" "), function(lines){
		
		//Remove the ACK of our sent message
		ACK = lines.shift();
		interpret_TP20_incoming(lines, function(fullmesage){
			callback(fullmesage)
		});
		
	});
	TP_send_seq++;
	if(TP_send_seq>16){
		TP_send_seq = 0;
	}
}

function request_block(block, callback){
	SendTPData(['21', block], function(data){
		console.error("block data", data)

		response_code = data.shift();//61 means block data, 7F is called negative by other librarys, there are other codes

		block_id = data.shift()
		
		var values = []
		while(data.length != 0){
			data_type = parseInt(data.shift(), 16)
			b1 = data.shift()
			b2 = data.shift()
			
			a = parseInt(b1, 16);
			b = parseInt(b2, 16);
			
			str = ''
			switch(data_type){
				case 1://Engine speed
					str = a*b*0.2+" (RPM)";
					break;
				case 5:
					str = (a * (b-100) * 0.1)+" (° C)";
					break;
				case 6://Supply voltage ECU
					str = a*b*0.001+" (V)";
					break;
				case 7://Vehicle speed
					str = a*b*0.01+" (km/h)";
					break;
				case 18:
					str = (0.04 * a * b)+" (mbar)";
					break;
				case 14:
					str = (0.005 * a * b)+" (bar)";
					break;
				case 21://Module. Piston, Movement Sender (???) Voltage
					str = 0.001 * a * b+" (V)";
					break;
				case 25:
					str = ((b * 1.421) + (a / 182))+" (g / s)";
					break;
				case 16:
					str = b1+' '+b2+' (bitvalue)';
					break;
				case 18:
					str = (a * b)+" (C.)";
					break;
				case 20:
					str = (a * (b-128) / 128)+' (%)';
					break;
				case 22:
					str = (0.001 * a * b)+" (ms)";
					break;
				case 31:
					str = (b / 2560 * a)+" (° C)";
					break;
				case 33:
					if(a == 0){
						str = 100 * b
					}else{
						str = 100 * b / a
					}
					str += " (%)";
					break;
				case 37:
					str = a+" "+b+" (Oil Pr. 2 <min)";
					break;
				case 47:
					str = ((b-128) * a)+" (ms)";
					break;
				case 48:
					str = (b + a * 255)+" (Count)";
					break;
				case 54:
					str = (a*256+b)+" (Count)";
					break;
				default:
					str = b1+' '+b2+' ('+data_type+')';
					break;
			}
			values.push(str);
		}

		callback(values);
	});
}

function request_diag(){
	//initiate diagnostics
	SendTPData(['10', '89'], function(data){
		console.error("TP 2.0 protocol Diag recived", data);
		
		console.error("Requesting block 02");
		request_block('01', function(dat){
			console.error("Got data from block 01", dat);
			request_block('02', function(dat){
				console.error("Got data from block 02", dat);
				request_block('03', function(dat){
					console.error("Got data from block 03", dat);
				});
			});
		});
	});
}
function setup_TP20_channel(dest){

	//Set Header (OBD, and CAN)(sent from address)
	execute_command("AT SH 200");

	//set CAN Receive filter to the senders address
	execute_command("AT CRA "+hexstr(0x200+dest));

	//Request a chanel to dest ECU request 300 as a virtual address
	execute_command(hexstr(dest)+" "+TP20_opcodes.Setup_request+" 00 10 00 03 01", function(lines){
		TP20response = TP20_line_cleanup(lines);
		if(TP20response[0][1] == TP20_opcodes.Positive_response){
			console.error("TP 2.0 protocol channel request was Approved")
		
			var VirtualCanAddress = (TP20response[0][5]+TP20response[0][4]).substr(1)

			//set CAN Send from to the senders request negotiated address
			execute_command("AT SH "+VirtualCanAddress);
			
			execute_command("AT CRA 300");
			
			//Send own channel parameters, request others
			execute_command(TP20_opcodes.Parameters_request+" 0F 8A FF 4A FF", function(lines){
				TP20response = TP20_line_cleanup(lines);
				console.error("TP 2.0 protocol channel parameters recived", TP20response)
				
				request_diag()
				
			});
			
		}else{
			console.error("TP 2.0 protocol channel request was denied")
		}
	});
}

function ELM_conection_established(){
	execute_command("AT Z");//request elm327 reset
	execute_command("AT E0");//request No echo
	execute_command("AT L0");//request No linefeeds
	execute_command("AT M0");//request No linefeeds
	execute_command("AT @1", function(lines){
		console.error("ELM name:", lines.join(''));
	});//request ELM name
	execute_command("AT PB C0 01");//set user mode B to  500kbps, 11 bit ID (set Protocol B options and baud rate)
	execute_command("AT SP B");//Set Protocol to B and save it (6-C is can bus) So now we are in canbus mode
	execute_command("AT H1");//Headers On
	execute_command("AT D1", function(){
		console.error("initiation done");
		process.stdin.resume();
		
		execute_command("AT ST 19");//Set Timeout to hh x 4 msec

		//setup_TP20_channel(0x1f);//Diagnostic Interface 31
		//setup_TP20_channel(0x01);//engine
		setup_TP20_channel(10);//awd
		
	});//display of the DLC On (CAN) Show length of message
}

var Writer = null;


function on_data_from_car(data, isNotification){
	reciving_response = reciving_response + data.toString();
	//console.error("data:", data);
	if(reciving_response.substr(reciving_response.length-2) == "\r>"){
		//respose done
		resp = reciving_response.substr(0, reciving_response.length-2);
		response_lines_raw = resp.split("\r");
		response_lines = [];
		for(x in response_lines_raw){
			if(response_lines_raw[x] != ''){
				response_lines.push(response_lines_raw[x])
			}
		}
		console.error("respose("+last_command.cmd+"):\n", response_lines);
		reciving_response = "";
		if(wating_for_response){
			clearTimeout(wating_for_response);
		}
		wating_for_response = false;
		if(last_command.callback){
			last_command.callback(response_lines, last_command.cmd);
		}
		
		try_send_command_from_que();
	}
	//process.stdout.write(data);
	//fs.appendFileSync('dump.dmp', Buffer.concat([Buffer.from("car:"), data, Buffer.from("\n")]));

	//DEBUG
	//console.error(data.toString());
	//console.log('from car:', data.toString(), isNotification)
}
function send_data_to_car(data){
	//console.error(data.toString());
	fs.appendFileSync('dump.dmp', Buffer.concat([Buffer.from("app:"), data, Buffer.from("\n")]));
	Writer.write(data, true, error_function);
}

noble.on('discover', function(peripheral) {
	//DEBUG
	console.error('found peripheral');
	peripheral.once('connect', function(){
		//DEBUG
		console.error('conected');
		process.on('exit', function (){
			//DEBUG
			console.error('disconecting');
			peripheral.disconnect();
		});
		peripheral.discoverServices(Service, function(error, services){
			if(error){
				console.error('scan error:', error)
			}
			for(x in services){
				services[x].discoverCharacteristics(['fff1', 'fff2'], function(error, characteristics){
					for(y in characteristics){
						if(characteristics[y].uuid == 'fff1'){
							characteristics[y].on('data', on_data_from_car);
							characteristics[y].subscribe(error_function);
							
							//DEBUG
							console.error('Subscribed to notifier');
						}else{
							Writer = characteristics[y];
							//DEBUG
							console.error('found Writer');
						}
					}
					setTimeout(ELM_conection_established, 500);
				});
			}
		});
	});
	peripheral.connect(error_function);
})


noble.startScanning(Service, false, error_function);


function error_function(error){
	if(error){
	  console.error('scan error:', error)
	}
}

