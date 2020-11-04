# elm-vag-block-js
Reading VAG measuring blocks with ELM327 adapter

# Goal
To read car data from the browser using a Bluetoth low energy adapter and the Web Bluetooth API.

# Todo

* Separate the code in to a node cli program and a library that can be used in the browser for the Web Bluetooth API.
* Parsing of ECU identification data

## Usage

``` bash

#node elm-vag-block.js ${address_of_ECU} ${command}

#retrive list of addresses to all the cars ECU's
node elm-vag-block.js 31 #The ecu on address 31 contains a list of all other ECU's

#scans all the identifications the ECU  on address 1 provides
node elm-vag-block.js 1 scan_identification 

#scans all the messuring blocks the ECU on address 1 provides
node elm-vag-block.js 1 scan_blocks

#reads messuring blocks 1 2 4 & 80 from an ecu
node elm-vag-block.js 1 read_blocks 1 2 4 80

#Scans the DTC codes of the ECU on adress 1 
node elm-vag-block.js 1 scan_DTC

#resets the DTC codes of the ECU on adress 1 
node elm-vag-block.js 1 reset_DTC

```

It trys to connect to your carista ELM327 low energy Bluetooth adapter. And talk TP2.0 to the cars ecus.


## Install
``` bash
npm install @abandonware/noble
```

@abandonware/noble can be hard to get building, make sure you get latest xcode for OSX and it should work.
