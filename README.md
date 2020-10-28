# elm-vag-block-js
Reading VAG measuring blocks with ELM327 adapter

# Goal
To read car data from the browser using a Bluetoth low energy adapter and the Web Bluetooth API.

# Todo

* Separate the code in to a node cli program and a library that can be used in the browser for the Web Bluetooth API.
* Parsing of ECU identification data

## Usage

``` bash
node elm-vag-block.js ${address_of_ECU}
```

Will try to connect to your carista ELM327 low energy Bluetooth adapter and read out the DTC faults, show some data from the messuring blocks.
To get a list of all the ECU's in the car: connect to the diagnostics ECU on address 31. Or you can try to reach the engine ECU, it is always on address 1.
``` bash
node elm-vag-block.js 31
```

## Install
``` bash
npm install @abandonware/noble
```

@abandonware/noble can be hard to get building, make sure you get latest xcode for OSX and it should work.
