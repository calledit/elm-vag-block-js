# elm-vag-block-js
Reading VAG measuring blocks with ELM327 adapter

# Goal
To read car data from the browser using a Bluetoth low energy adapter and the Web Bluetooth API.

# Todo

* Separate the code in to a node cli program and a library that can be used in the browser for the Web Bluetooth API.
* Parsing of ECU identification data

## Usage
Run
``` bash
node elm-vag-block.js ${address_of_ECU}
```

it will try to connect to your carista ELM327 low energy Bluetooth adapter and read out the code blocks
Connect to the diagnostics ECU on address 31 to get a list of all the other ECU's
``` bash
node elm-vag-block.js 31
```

## Install
npm install @abandonware/noble

It can be a pain to get building make sure you get latest xcode OSX and it should work.
