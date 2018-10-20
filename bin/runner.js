#! /usr/bin/env node

const fs = require( 'fs' );
const os = require( 'os' );
const { exec } = require( 'child_process' );

/**
 * Console modifiers (x platform)
 */
const bold = '\x1b[1m';
const clear = '\x1b[0m';
const ylw = '\x1b[33m';
const green = '\x1b[32m';
const red = '\x1b[31m';
const cyan = '\x1b[36m';
const bgRed = '\x1b[41m';
const bgGreen = '\x1b[42m';
const uds = '\x1b[4m';


/**
 * Main logic
 */
const startTime = Date.now();

const tasksFile = process.argv[2];
const rawCmd = Array.from( process.argv ).join(' ');

console.log( tasksFile, rawCmd)

const failOnStderr = rawCmd.includes( '--fail-on-stderr' );
const noPrintStdout = rawCmd.includes( '--no-stdout' );
const noPrintStderr = rawCmd.includes( '--no-stderr' );

/**
 * Output interactions
 */
const printRunnerStarting = _tasks => {
  console.log( `${bold}${ylw}${uds}\nTasks to execute: ${_tasks.length}${clear}` );
  console.log( `We have ${os.cpus().length} cpus, thus optimizing parallelism.\n` );
  _tasks.forEach( ( t, i ) => console.log( `${i + 1}: ${t}` ) );
  console.log( '\n' );
};

const printTaskResult = ( task, index, errored, stdout, stderr ) => {
  console.log( `\n${ylw}${bold}${uds}Task ${index + 1} results${clear}` );
  console.log( `${cyan}[cmd]${clear} ${task}\n` );

  if ( !noPrintStdout ) {
    console.log( `${green}[stdout]${clear}` );
    console.log( stdout.join( '' ) );
  }

  if ( stderr.length > 0 && !noPrintStderr ) {
    console.log( `${red}[stderr]${clear}` );
    console.log( stderr.join( '' ) );
  }

  const [ result, bgColor ] = errored ? [ 'Error', bgRed ] : [ 'Ok', bgGreen ];
  console.log( `\n${bgColor}  ${clear} Task ${index + 1}: ${result}${clear}` );
};

const roundTime = time => `${( time / 1000 ).toFixed( 3 )}s`;

const printFailMessage = ( failCount, time ) => {
  const message = `All done in ${roundTime( time )}. ${failCount} tasks failed.`;
  console.log( `${bold}${red}${message}${clear}` );
};

const printPassMessage = time => {
  const message = `All tasks were executed with success in ${roundTime( time )}!`;
  console.log( `${bold}${green}${message}${clear}` );
};

const tasks = Buffer.from( fs.readFileSync( tasksFile ) ).toString().split( '\n' )
  .filter( line => !line.startsWith( '#' ) && line.trim().length !== 0 );

printRunnerStarting( tasks );

const threshold = os.cpus().length + 1;
const taskStack = [].concat( tasks );
const scanTime = 100;
let imcompleteCount = tasks.length;
let failCount = 0;
let running = 0;

const processResult = ( ) => {
  const endTime = Date.now();
  const timeDelta = endTime - startTime;

  if ( failCount > 0 ) {
    printFailMessage( failCount, timeDelta );
  } else {
    printPassMessage( timeDelta );
  }

  process.exit( failCount > 0 ? 1 : 0 );
};

const runTask = task => {
  const i = tasks.indexOf( task );
  const proc = exec( task, { } );
  const stdout = [];
  const stderr = [];

  proc.stdout.on( 'data', d => stdout.push( String( d ) ) );
  proc.stderr.on( 'data', d => stderr.push( String( d ) ) );

  proc.on( 'exit', code => {
    running--;
    imcompleteCount--;
    const errored = code === 1 || (failOnStderr && stderr.length > 0);

    printTaskResult( task, i, errored, stdout, stderr );

    if ( errored ) { failCount++; }
  } );
};

const loop = setInterval( () => {
  if ( imcompleteCount === 0 ) {
    clearTimeout( loop );
    processResult();
  }

  if ( taskStack.length === 0 ) { return; }

  if ( running < threshold ) {
    running++;
    runTask( taskStack.shift() );
  }
}, scanTime );
