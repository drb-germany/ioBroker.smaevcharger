'use strict';

/*
 * Created with @iobroker/create-adapter v2.3.0
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
const utils = require('@iobroker/adapter-core');
const axios = require('axios').default;
const https = require('https');

const instance = axios.create({
	httpsAgent: new https.Agent({
		rejectUnauthorized: false,
	}),
});

// Load your modules here, e.g.:
// const fs = require("fs");

class Smaevcharger extends utils.Adapter {
	/**
	 * @param {Partial<utils.AdapterOptions>} [options={}]
	 */
	constructor(options) {
		super({
			...options,
			name: 'smaevcharger',
		});
		this.on('ready', this.onReady.bind(this));
		// this.on('stateChange', this.onStateChange.bind(this));
		// this.on('objectChange', this.onObjectChange.bind(this));
		// this.on('message', this.onMessage.bind(this));
		this.on('unload', this.onUnload.bind(this));

		this.updateRead = null;
		this.updateWrite = null;
		this.connectionToken = '';
		this.connectionTokenReceived = new Date();
	}

	async intervalRead() {
		if (this.updateRead) {
			this.clearTimeout(this.updateRead);
		}

		// do work
		this.log.debug(`Calling read`);

		// make sure we have a token
		await this.getToken();

		instance
			.post(`https://${this.config.chargerip}/api/v1/measurements/live/`, [{ componentId: 'IGULD:SELF' }], {
				headers: {
					accept: 'application/json, text/plain, */*',
					'content-type': 'application/json',
					Authorization: `Bearer ${this.connectionToken}`,
				},
			})
			.then((response) => {
				this.log.debug(`Response code ${response.status}`);
				if (response.status === 200) {
					// parse data
					response.data.forEach((item) => {
						if (item.channelId === 'Measurement.Chrg.ModSw') {
							// record this for understanding
							this.setState('rawdata.ChrgModSw', item.values[0].value, true);

							if (item.values[0].value === 4718)
								this.setState('charger.switchStateFastCharge', true, true);
							else this.setState('charger.switchStateFastCharge', false, true);
						}
						if (item.channelId === 'Measurement.Operation.EVeh.Health') {
							// record this for understanding
							this.setState('rawdata.EVehHealth', item.values[0].value, true);

							// do this later after understanding the different states
							//this.setState('charger.health', item.values[0].value, true);
						}
						if (item.channelId === 'Measurement.Operation.EVeh.ChaStt') {
							// record this for understanding
							this.setState('rawdata.EVehChaStt', item.values[0].value, true);

							// 5169: connected, not charging
							// 200113: connected, charging
							// 200111: not connected

							if (item.values[0].value === 5169) {
								this.setState('charger.carConnected', true, true);
								this.setState('charger.carCharging', false, true);
							} else if (item.values[0].value === 200113) {
								this.setState('charger.carConnected', true, true);
								this.setState('charger.carCharging', true, true);
							} else if (item.values[0].value === 200111) {
								this.setState('charger.carConnected', false, true);
								this.setState('charger.carCharging', false, true);
							}
						}
						if (item.channelId === 'Measurement.ChaSess.WhIn') {
							this.setState('charger.currentEnergy', item.values[0].value, true);
						}
						if (item.channelId === 'Measurement.Metering.GridMs.TotWIn') {
							this.setState('charger.currentPower', item.values[0].value, true);
						}
						if (item.channelId === 'Measurement.GridMs.A.phsA') {
							this.setState('charger.currentPhaseA', -item.values[0].value, true);
						}
						if (item.channelId === 'Measurement.GridMs.A.phsB') {
							this.setState('charger.currentPhaseB', -item.values[0].value, true);
						}
						if (item.channelId === 'Measurement.GridMs.A.phsC') {
							this.setState('charger.currentPhaseC', -item.values[0].value, true);
						}
					});
				} else {
					this.log.error(`Error, could not connect, response code ${response.status}`);
				}
			})
			.catch((error) => {
				this.log.error(`Could not connect to charger, error: ${error}`);
				// we reset the connectionToken if we were not able to get data
				this.connectionToken = '';
			});

		this.updateRead = this.setTimeout(async () => {
			this.updateRead = null;
			await this.intervalRead();
		}, this.config.updateRateRead * 1000);
	}

	async intervalWrite() {
		if (this.updateWrite) {
			this.clearTimeout(this.updateWrite);
		}

		// do work
		this.log.debug(`Calling write`);

		this.updateWrite = this.setTimeout(async () => {
			this.updateWrite = null;
			await this.intervalWrite();
		}, this.config.updateRateWrite * 1000);
	}

	async getToken() {
		// if we do not have a connectionToken, we have to get one, or if the one we have is older then one hour, we renew
		if (!this.connectionToken || (new Date().getTime() - this.connectionTokenReceived.getTime()) / 1000 > 3600) {
			await instance
				.post(
					`https://${this.config.chargerip}/api/v1/token`,
					{
						grant_type: 'password',
						username: this.config.username,
						password: this.config.password,
					},
					{
						headers: {
							accept: 'application/json, text/plain, */*',
							'content-type': 'application/x-www-form-urlencoded;charset=UTF-8',
						},
					},
				)
				.then((response) => {
					this.log.debug(`Response code ${response.status}`);
					if (response.status === 200) {
						this.setState('info.connection', true, true);
						this.connectionToken = response.data.access_token;
						this.connectionTokenReceived = new Date();
						this.log.debug(`Token received`);
					} else {
						this.setState('info.connection', false, true);
						this.log.error(`Error, could not connect, response code ${response.status}`);
					}
				})
				.catch((error) => {
					this.log.error(`Could not connect to charger, error: ${error}`);
				});
		}
	}

	/**
	 * Is called when databases are connected and adapter received configuration.
	 */
	async onReady() {
		// Initialize your adapter here

		// Reset the connection indicator during startup
		this.setState('info.connection', false, true);
		this.log.info(`Connecting to ${this.config.chargerip}`);

		// get first token
		// await this.getToken();

		// initialize variables
		await this.setObjectNotExistsAsync('charger.carConnected', {
			type: 'state',
			common: {
				name: 'Car is connected',
				type: 'boolean',
				role: 'indicator',
				read: true,
				write: false,
			},
			native: {},
		});
		await this.setObjectNotExistsAsync('charger.carCharging', {
			type: 'state',
			common: {
				name: 'Car is charging',
				type: 'boolean',
				role: 'indicator',
				read: true,
				write: false,
			},
			native: {},
		});
		await this.setObjectNotExistsAsync('charger.switchStateFastCharge', {
			type: 'state',
			common: {
				name: 'SMA EV Charger switch is set to fast charge',
				type: 'boolean',
				role: 'indicator',
				read: true,
				write: false,
			},
			native: {},
		});
		await this.setObjectNotExistsAsync('charger.currentEnergy', {
			type: 'state',
			common: {
				name: 'Total energy for this process',
				unit: 'Wh',
				type: 'number',
				role: 'value',
				read: true,
				write: false,
			},
			native: {},
		});
		await this.setObjectNotExistsAsync('charger.currentPower', {
			type: 'state',
			common: {
				name: 'Current power',
				unit: 'W',
				type: 'number',
				role: 'value',
				read: true,
				write: false,
			},
			native: {},
		});
		await this.setObjectNotExistsAsync('charger.currentPhaseA', {
			type: 'state',
			common: {
				name: 'Current on phase A',
				unit: 'A',
				type: 'number',
				role: 'value',
				read: true,
				write: false,
			},
			native: {},
		});
		await this.setObjectNotExistsAsync('charger.currentPhaseB', {
			type: 'state',
			common: {
				name: 'Current on phase B',
				unit: 'A',
				type: 'number',
				role: 'value',
				read: true,
				write: false,
			},
			native: {},
		});
		await this.setObjectNotExistsAsync('charger.currentPhaseC', {
			type: 'state',
			common: {
				name: 'Current on phase C',
				unit: 'A',
				type: 'number',
				role: 'value',
				read: true,
				write: false,
			},
			native: {},
		});

		await this.setObjectNotExistsAsync('rawdata.EVehHealth', {
			type: 'state',
			common: {
				name: 'EVehHealth',
				type: 'number',
				role: 'value',
				read: true,
				write: false,
			},
			native: {},
		});
		await this.setObjectNotExistsAsync('rawdata.EVehChaStt', {
			type: 'state',
			common: {
				name: 'EVehChaStt',
				type: 'number',
				role: 'value',
				read: true,
				write: false,
			},
			native: {},
		});
		await this.setObjectNotExistsAsync('rawdata.ChrgModSw', {
			type: 'state',
			common: {
				name: 'ChrgModSw',
				type: 'number',
				role: 'value',
				read: true,
				write: false,
			},
			native: {},
		});

		this.intervalRead();
		this.intervalWrite();
	}

	/**
	 * Is called when adapter shuts down - callback has to be called under any circumstances!
	 * @param {() => void} callback
	 */
	onUnload(callback) {
		try {
			if (this.updateRead) {
				this.clearTimeout(this.updateRead);
			}
			if (this.updateWrite) {
				this.clearTimeout(this.updateWrite);
			}

			callback();
		} catch (e) {
			callback();
		}
	}

	// If you need to react to object changes, uncomment the following block and the corresponding line in the constructor.
	// You also need to subscribe to the objects with `this.subscribeObjects`, similar to `this.subscribeStates`.
	// /**
	//  * Is called if a subscribed object changes
	//  * @param {string} id
	//  * @param {ioBroker.Object | null | undefined} obj
	//  */
	// onObjectChange(id, obj) {
	// 	if (obj) {
	// 		// The object was changed
	// 		this.log.info(`object ${id} changed: ${JSON.stringify(obj)}`);
	// 	} else {
	// 		// The object was deleted
	// 		this.log.info(`object ${id} deleted`);
	// 	}
	// }

	/**
	 * Is called if a subscribed state changes
	 * @param {string} id
	 * @param {ioBroker.State | null | undefined} state
	 */
	// onStateChange(id, state) {
	// 	if (state) {
	// 		// The state was changed
	// 		this.log.info(`state ${id} changed: ${state.val} (ack = ${state.ack})`);
	// 	} else {
	// 		// The state was deleted
	// 		this.log.info(`state ${id} deleted`);
	// 	}
	// }

	// If you need to accept messages in your adapter, uncomment the following block and the corresponding line in the constructor.
	// /**
	//  * Some message was sent to this instance over message box. Used by email, pushover, text2speech, ...
	//  * Using this method requires "common.messagebox" property to be set to true in io-package.json
	//  * @param {ioBroker.Message} obj
	//  */
	// onMessage(obj) {
	// 	if (typeof obj === 'object' && obj.message) {
	// 		if (obj.command === 'send') {
	// 			// e.g. send email or pushover or whatever
	// 			this.log.info('send command');

	// 			// Send response in callback if required
	// 			if (obj.callback) this.sendTo(obj.from, obj.command, 'Message received', obj.callback);
	// 		}
	// 	}
	// }
}

if (require.main !== module) {
	// Export the constructor in compact mode
	/**
	 * @param {Partial<utils.AdapterOptions>} [options={}]
	 */
	module.exports = (options) => new Smaevcharger(options);
} else {
	// otherwise start the instance directly
	new Smaevcharger();
}
