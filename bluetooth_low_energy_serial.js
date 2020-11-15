/*
STDIN -> bluetooth low energy
bluetooth low energy -> STDOUT
*/
var noble = require('@abandonware/noble');
const fs = require('fs');

process.stdin.resume();

process.setMaxListeners(265);

//var DEBUG = false;

var Service = [
 'fff0'//carista
];

process.stdin.on('data', function(data) {
	send_data_to_car(data);
	
	//DEBUG
	//send_data_to_car(Buffer.from(data+"\r", 'utf8'))
	//console.log('data:', data);
});

var Writer = null;


function on_data_from_car(data, isNotification){
	process.stdout.write(data);
	//fs.appendFileSync('dump.dmp', Buffer.concat([Buffer.from("car:"), data, Buffer.from("\n")]));

	//DEBUG
	//console.error(data.toString());
	//console.log('from car:', data.toString(), isNotification)
}
function send_data_to_car(data){
	//console.error(data.toString());
	//fs.appendFileSync('dump.dmp', Buffer.concat([Buffer.from("app:"), data, Buffer.from("\n")]));
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
			//console.log('disconected');
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
