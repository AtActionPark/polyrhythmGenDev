"use strict";
// USER PARAMS
var tempo = 60.0;
//nb of steps per bar
var resolution = 4;
//duration of notes
var subdivision = 4;
//proba of having a beat on each step
var densityCategory = 2;
//limit for the result length in steps
var maxLength = 64;
var useLeftFoot = true;
var orchestrate = true;
var euclideanRhythm = false;
var nbOfRhythms = 1;

//FIXED PARAMS
// sequences length
var minStep = 2;
var maxStep = 11;
var flaTime = 0.04;
var possibleSubdivisions = [2,4,8];


//limb bias - some limbs will play a higher average nb of notes
var lHandDensityFactor = 1;
var rHandDensityFactor = 1;
var lFootDensityFactor = 0.7;
var rFootDensityFactor = 0.8;

var seedPrecision = 5;
var maxTry = 500;
var metronomeMute = true;

//mixer volumes
var snareGain = 0.6;
var kickGain = 0.9;
var clHiHatGain = 1;
var opHiHatGain = 0.9;
var footHiHatGain = 0.9;
var highTomGain = 0.9;
var medTomGain = 0.9;
var floorTomGain = 0.9;
var rideGain = 0.6;
var metronomeGain = 0.6;


//SCHEDULER
var lookahead = 25.0;
var scheduleAheadTime = 0.1;
var schedulerTimer;
var nextNoteTime = 0.0;

//stuff
var commandList = [];
var cursor = 0;
var max = 1;
var play = true;
var context;
var bufferLoader;
var empty = "-";
var generationSeed;
var seed;
var density;

var lHandLength = 0;
var rHandLength =0;
var lFootLength = 0;
var rFootLength = 0;

var forceLength = false;
var forceLeftHand = 0;
var forceRightHand = 0;
var forceLeftFoot = 0;
var forceRightFoot = 0;

var kickSound = null;
var snareSound = null;
var clHiHatSound = null;
var opHiHatSound = null;
var metronomeSound = null;
var rideSound = null;
var highTomSound = null;
var medTomSound = null;
var floorTomSound = null;

var locked = true;

//canvas stuff
var canvas;
var ctx;
var startSpace = 80;
var hStartSpace = 20;
var hSpace = 20;
var wSpace = 20;
var noteRadius = hSpace/3;
var noteRadiusSmall = hSpace/4;
var rideBias = 3;

$(document).ready(function(){
  var iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  window.AudioContext = window.AudioContext || window.webkitAudioContext;

  context = new AudioContext();
  context.suspend();
  initCanvas();

  if(iOS){
    window.addEventListener("touchend",iosHandler , false);
  }
  else{
    //async loading of all samples
    loadSamples();
    readURL();
    $(".tiptext").mouseover(function() {
      $(this).children(".description").show();
    }).mouseout(function() {
        $(this).children(".description").hide();
    });
  }
  $(document).on("click", ".dropdown-menu", (e) => e.stopPropagation());
  $(".dropdown").on({
    "shown.bs.dropdown": function() { this.closable = false; },
    "click":             function() { this.closable = true; },
    "hide.bs.dropdown":  function() { return this.closable; }
  });

  
});

function iosHandler(e){
  if (locked){

    alert("unlocked");
    locked = false;
    // create empty buffer
    var buffer = context.createBuffer(1, 1, 22050);
    var source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(context.destination);
    source.noteOn(0);

    loadSamples();
    readURL();
  }
}

//entry point for generation.
function generateSong(){
  generationSeed = Math.random();
  generationSeed = generationSeed.toFixed(seedPrecision);

  seed = generationSeed;
  generateAndStart();
}
function generateAndStart(){
  reset();

  getUserParams();
  $("#seed").html(generateSeed(seed));

  //Need to check against specified max desired length

  //if user specified all lengths, max length is not variable
  if(forceLength){
    generateLengths();
  }
  // else, give the generator a few tries to find it
  else{
    var count = 0;
    do {
      generateLengths();
      count++;
    }while(max > maxLength  && count <maxTry); 
  }
  

  createDrumCommands();
  displayParams();

  drawSheet();

  setInterval(scheduler, 20);
  play = true;
}
function getUserParams(){
  resolution = parseInt($("#resolution").val());
  subdivision = parseInt($("#subdivision").val());

  tempo = parseInt($("#tempo").val());

  maxLength = parseInt($("#maxLength").val());
  if(maxLength<resolution){
    replaceMaxLength(resolution);
  }

  densityCategory = parseInt($("#density").val());
  density = densityCategory*25;

  nbOfRhythms = parseInt($("#nbOfRhythms").val());

  useLeftFoot = $("#leftFoot").is(":checked");
  orchestrate = $("#orchestrate").is(":checked");
  euclideanRhythm = $("#euclidean").is(":checked");

  if(forceLength){
    changeForce();
  }

  checkMaxLength();
}
function randomize(){
  generationSeed = Math.random();
  generationSeed = generationSeed.toFixed(seedPrecision);
  seed = generationSeed;


  var t = getRandomInt(30,120);
  $("#tempo").val(t);
  var r = getRandomInt(2,9);
  $("#resolution").val(r);
  var sub = pickRandomArray(possibleSubdivisions);
  $("#subdivision").val(sub);
  var mxl = getRandomInt(20,80);
  $("#maxLength").val(mxl);
  var d = getRandomInt(0,4);
  $("#density").val(d);
  var nbr = getRandomInt(2,4);
  $("#nbOfRhythms").val(nbr);
  var lf = getRandomInt(0,1);
  $("#leftFoot").prop("checked", lf);
  var or = getRandomInt(0,1);
  $("#orchestrate").prop("checked", or);
  var eu = getRandomInt(0,1);
  $("#euclidean").prop("checked", eu);
  generateSong();

}
function changeTempo(){
  tempo = parseInt($("#tempo").val());
  if(tempo<1){
    tempo = 1;
  }
  $("#seed").html(generateSeed(seed));
}
function changeForceLength(){
  forceLength = $("#forceLength").is(":checked");
  $("#forceLeftHand").prop("disabled", !forceLength);
  $("#forceLeftFoot").prop("disabled", !forceLength);
  $("#forceRightHand").prop("disabled", !forceLength);
  $("#forceRightFoot").prop("disabled", !forceLength);

  $("#nbOfRhythms").prop("disabled", forceLength);
  $("#maxLength").prop("disabled", forceLength);
}
function changeForce(){
  forceLeftHand = parseInt($("#forceLeftHand").val());
  forceRightHand = parseInt($("#forceRightHand").val());
  forceLeftFoot = parseInt($("#forceLeftFoot").val());
  forceRightFoot = parseInt($("#forceRightFoot").val());
}
function readURL(){
  var url = window.location.href ;
  var captured;
  if(url.includes("?")){
    captured = /\?([^&]+)/.exec(url)[1]; 
    loadSeed(captured);
  }
}
function reset(){
  context.resume();
  clearInterval(schedulerTimer);
  cursor = 0;
  commandList = [];
  generateLengths();
}


//compute the minimum length with params and compare with user expectation
function checkMaxLength(){
  if(!forceLength){
    var mini = minPossibleLength(resolution,nbOfRhythms);
    if(mini>maxLength){
      replaceMaxLength(mini);
    }
  }
}
function replaceMaxLength(mini){
  maxLength = mini;
  $("#maxLength").val(mini);
  $("#maxLength").fadeIn(100).fadeOut(100).fadeIn(100).fadeOut(100).fadeIn(100);
}


//SEED
//Concatenates all needed params for the seed
function generateSeed(){
  var subString = convertBase(resolution.toString(),10,12) 
    + ""+ parseInt(subdivision) 
    + ""  + parseInt(densityCategory) 
    + ""+ parseInt(nbOfRhythms) 
    +  "" + (useLeftFoot?1:0) + "" 
    + (orchestrate?1:0) + "" 
    + (euclideanRhythm?1:0);

  var s = parseInt(tempo) + "-" 
    + parseInt(maxLength) + "-" 
    + subString  ;

  var convertedParams = convertBase(s,13,64);
  var convertedSeed = convertBase(Math.round(parseFloat(generationSeed,10) * Math.pow(10,seedPrecision)).toString(),10,64);

  var result = convertedParams + "@" +  convertedSeed;

  if(forceLength){
    var forceString = "";
    forceString+= convertBase(forceLeftHand.toString(),10,12);
    forceString+= "" + convertBase(forceRightHand.toString(),10,12);
    forceString+= "" + convertBase(forceLeftFoot.toString(),10,12);
    forceString+= "" + convertBase(forceRightFoot.toString(),10,12);
    var convertedForceString = convertBase(forceString,12,64);
    result+= "@"+ convertedForceString;
  }
  return result;
}

//Reads the seed value input 
function readSeed(){
  var input = $("#seedInput").val().trim();
  loadSeed(input);
}
//generates a song according to the seed
function loadSeed(input){
  var s =input.split(/@/g);
  var convertedParams = s[0];
  var convertedSeed = s[1];
  var convertedForce = s[2];

  var reconvertedParams = convertBase(convertedParams,64,13);

  var reconvertedSeed = parseFloat(convertBase(convertedSeed,64,10),10).toFixed(seedPrecision);
  seed = reconvertedSeed/Math.pow(10,seedPrecision) || 1;

  if(convertedForce){
    var reconvertedForce = convertBase(convertedForce,64,12);
  }
  var params = reconvertedParams.split(/-/g);

  tempo = parseInt(params[0]) || 60;
  $("#tempo").val(tempo);

  maxLength = parseInt(params[1]) || 32;
  $("#maxLength").val(maxLength);

  var paramsSubString = params[2].toString();
  paramsSubString = paramsSubString.split("");


  resolution = parseInt(convertBase(paramsSubString[0].toString(),12,10)) ||4;
  $("#resolution").val(resolution);

  subdivision = paramsSubString[1] ||4;
  $("#subdivision").val(subdivision);


  densityCategory = paramsSubString[2] || 0.5;
  $("#density").val(parseInt(densityCategory));
  density = densityCategory*20;

  nbOfRhythms = paramsSubString[3] || 2;
  $("#nbOfRhythms").val(parseInt(nbOfRhythms));

  useLeftFoot = paramsSubString[4] ==0? false: true|| false;
  $("#leftFoot").prop("checked", useLeftFoot);

  orchestrate = paramsSubString[5] ==0? false: true|| false;
  $("#orchestrate").prop("checked", orchestrate);

  euclideanRhythm = paramsSubString[6] ==0? false: true|| false;
  $("#euclidean").prop("checked", euclideanRhythm);

  

  forceLeftHand = 0;
  forceRightHand = 0;
  forceLeftFoot = 0;
  forceRightFoot = 0;
  if(reconvertedForce!= null){
    var force = reconvertedForce.split("");
    forceLeftHand = parseInt(convertBase(force[0],12,10)) || 0;
    forceRightHand = parseInt(convertBase(force[1],12,10)) || 0;
    forceLeftFoot = parseInt(convertBase(force[2],12,10)) || 0;
    forceRightFoot = parseInt(convertBase(force[3],12,10)) || 0;
    forceLength = false;
    $("#forceLength").prop("checked", forceLength);
    changeForceLength();
  }

  if(forceRightFoot>0 || forceRightHand>0 || forceLeftFoot>0 || forceLeftHand >0){
    forceLength = true;
    $("#forceLength").prop("checked", forceLength);
    changeForceLength();
    $("#forceLeftHand").val(parseInt(forceLeftHand));
    $("#forceRightHand").val(parseInt(forceRightHand));
    $("#forceLeftFoot").val(parseInt(forceLeftFoot));
    $("#forceRightFoot").val(parseInt(forceRightFoot));
  }

  generationSeed = seed;
  
  $("#seed").html(generateSeed());
  
  generateAndStart();
}
function shareSeed(){
  //
  window.history.pushState("seed", "seed", "/PolyrhythmGenerator/?"+generateSeed());
}



//SCHEDULER
//Advances the cursor for reading sequences and update display
function nextNote(){
  var secondsPerBeat = 60.0 / tempo *resolution/subdivision;
  nextNoteTime +=secondsPerBeat/resolution;
  var c = cursor+1;
  cursor++;

  drawSheet(c);
  if (cursor == max){
      cursor = 0;
  }
 }
//Look at the sequences and play all scheduled notes
function scheduler(){
  if(!play){
    return;
  }
  while(nextNoteTime < context.currentTime + scheduleAheadTime){
    commandList.forEach((c) => c.play(cursor));
    nextNote();
  }
}
function pause(){
  play = !play;
  if(!play){
    context.suspend();
  }
  else{
    context.resume();
  }
  $("#pause").html(play? "Pause":"Play");
}


//LIMB
//This is needed because the output needs to be playable. It's not enough to randomize every piece of the drum set,
// we need to make sure that we have at most 4 hits at the same time, and that each limb has a set of associated instruments
function Limb(name){
  this.name = name;
  this.instruments = getInstrument(name);
  this.gain = context.createGain();
  this.gain.connect(context.destination);
}
//To play a note we need the intrument played (kick, snare...), as well as the cursor position. This is needed to check for flas
Limb.prototype.play = function(instr,c){
  this.source = context.createBufferSource();
  this.source.connect(this.gain);
  this.source.buffer = getBuffer(instr);
  this.gain.gain.value = getGain(instr);

  var time = 0;
  if(isFla(this.name,c)){
    time = context.currentTime + flaTime;
  }
  
  this.source.start(time);
};

//COMMAND
//Command: stores limb + associated sequence of note
function Command(limb, sequence, name){
  this.limb  = limb;
  this.sequence = sequence;
  this.sequenceRepeated = [];
  this.name = name;
  this.mute = false;
}
//Play the note at the cursor position
Command.prototype.play = function(c){
  if(this.muted){
    return;
  }

  var limb = this.limb;
  if(this.sequenceRepeated[c] != empty ){
    limb.play(this.sequenceRepeated[c],c);
  }
};
//Returns basic info/buttons for the sequence
Command.prototype.display = function(){
  var mute = "<input id=" + this.name + " type=checkbox><label></label> ";
  var length = " : " + this.sequence.length  + " steps";
  var result = "";
  for(var i = 0;i<this.sequence.length;i++){
    result +=  this.sequence[i] + " ";
  }

  if(this.name == "Metronome"){
    return  mute + "<div class='limbDiv' ><b>" + "<div class='inline '"+ this.name + ">" + this.name + "</b></div></div></br></br>";
  }
  return mute + "<div class='limbDiv' ><b>" + "<div class='inline '"+ this.name + ">" + this.name + "</div>" + length + " : " + result +  "</b></div></br>";
}

//MAIN ALGO
//generates the length of the sequence for each limb. Depending on the nbOfRhythms, all sequences' lengths could be the same or different
function generateLengths(){
  //start by making sure that the resolution is in the array of possible lengths
  var lengths = [resolution];

  //continue populationg the array until we have 3 additional random values
  while(lengths.length<4){
    var randomnumber=getRandomInt(minStep,maxStep);
    var found=false;
    for(var i=0;i<lengths.length;i++){
      if(lengths[i]==randomnumber){
        found=true;break;
      }
    }
    if(!found){
      lengths[lengths.length]=randomnumber;  
    }
  }

  //depending on the difficulty, replace some of the length to be equal to some other
  if(nbOfRhythms == 1){
    lengths[1] = lengths[0];
    lengths[2] = lengths[1];
    lengths[3] = lengths[2];
  }
  else if(nbOfRhythms == 2){
    lengths[2] = lengths[1];
    lengths[3] = lengths[2];
  }
  else if(nbOfRhythms == 3){
    lengths[3] = lengths[2];
  }

  //shuffle the array 
  // if we only shuffle after the first element, we can make sure that the left foot
  // will get a sequence length = resolution, for an easier scenario
  if(getRandomFloat(0,100)<(1-nbOfRhythms)*100){
    lengths = lengths.slice(1,4).shuffle();
    lengths.unshift(resolution);
  }
  else{
    lengths = lengths.shuffle();
  }

  lFootLength = lengths[0];
  lHandLength = lengths[1];
  rHandLength = lengths[2];
  rFootLength = lengths[3];

  if(forceLength){
     lHandLength = forceLeftHand;
     lFootLength = forceLeftFoot;
     rHandLength = forceRightHand;
     rFootLength = forceRightFoot;
  }

  lengths = [lFootLength,lHandLength,rFootLength,rHandLength];

  // compute the max number of steps of the song
  max = getLoopLength(lengths);
}
function getLoopLength(arr){
  var result = 1;
  for(var i = 0;i<arr.length;i++){
    result = lcm(result,arr[i]);
  }
  return result;
}
//Generates sequence of notes based on random params and precalculated length
function randomSequence(limb){
  if(euclideanRhythm){
    var pulses = parseInt(getRandomInt(minStep,getLength(limb.name)*1.0*getDensity(limb.name)/100));
    var pattern = bjorklund(getLength(limb.name),pulses);
    for(var i = 0;i<pattern.length;i++){
      if(pattern[i] == 1){
        pattern[i] = pickRandomArray(limb.instruments);
      }
      else{
        pattern[i] = empty;
      }
    }

    return pattern;
  }
  

  var seq = [];
  var stepsAdded = 0;
  //Initialize the sequence with all empty steps
  for(var i = 0;i<getLength(limb.name);i++){
    var instrument = pickRandomArray(limb.instruments);
    seq[i] = empty;
    //randomly add notes
    if(getRandomFloat(0,1)*100<getDensity(limb.name)){
      seq[i] = instrument;
      stepsAdded++;
    }
    //extra chance to add note on sequence start
    if(i%length == 0 && getRandomFloat(0,1)*50<getDensity(limb.name)){
      seq[i] = instrument;
      stepsAdded++;
    }
  }
  //if empty, add one random step
  if(stepsAdded == 0){
    seq[getRandomInt(0,seq.length-1)] = instrument;
  }
  return seq;
}
//Generate 1 random commands for each limb and adds them to the command list
function createDrumCommands(){
  commandList = [];

  var metronome = new Limb("metronome");
  var metronomeSequence = ["metronome"];
  var metronomeCommand = new Command(metronome,metronomeSequence,"Metronome");
  metronomeCommand.muted = metronomeMute;
  commandList.push(metronomeCommand);

  var leftHand = new Limb("leftHand");
  var leftHandSeq = randomSequence(leftHand);
  var leftHandCommand = new Command(leftHand,leftHandSeq,"LeftHand");
  commandList.push(leftHandCommand);

  var rightHand = new Limb("rightHand");
  var rightHandSeq = randomSequence(rightHand);
  var rightHandCommand = new Command(rightHand,rightHandSeq,"RightHand");
  commandList.push(rightHandCommand);

  var leftFoot = new Limb("leftFoot");
  var leftFootSequence = randomSequence(leftFoot);
  var leftFootCommand = new Command(leftFoot,leftFootSequence,"LeftFoot");
  if(useLeftFoot){
    commandList.push(leftFootCommand);
  }

  var rightFoot = new Limb("rightFoot");
  var rightFootSequence = randomSequence(rightFoot);
  var rightFootCommand = new Command(rightFoot,rightFootSequence,"RightFoot");
  commandList.push(rightFootCommand);

  
  //repeat each sequence so that their total length is the max nb of steps
  commandList.forEach(function(c){
    var n = max/c.sequence.length;
    c.sequenceRepeated = repeatArray(c.sequence,n);
  })

  //go through the sequence and check simultaneaous hand and foot hihat
  for(var c = 0;c<max;c++){
    if(commandList[3].sequenceRepeated[c] == "footHiHat" ){
      if(commandList[1].sequenceRepeated[c] == "opHiHat"){
        commandList[1].sequenceRepeated[c] = "clHiHat";
      }
      if(commandList[2].sequenceRepeated[c] == "opHiHat"){
        commandList[2].sequenceRepeated[c] = "clHiHat";
      }
    }
  }
  

  //compute the nb of bars needed
  var loops = Math.floor(max/resolution);
  var remainder = max%resolution;
  var remain = remainder == 0 ? "" : (" and " + remainder + " steps");
  $("#loop").html("Loops in <b>" + loops + "</b> " + resolution +  "/" + subdivision+ " bars" + remain + " ("+ max+ " steps)" );
}

//DISPLAY
//Display characteristics of the random ong and add a mute command
function displayParams(){
  $("#summary").empty();
  $("#pauseDiv").empty();
  $("#pauseDiv").append("<button id='pause' class='btn btn-default' onClick='pause()''>Pause</button>");

  $("#limbs").empty();

  commandList.forEach(function(c){
    $("#limbs").append(c.display());
    //show mute icon
    if(c.muted){
      $("#" + c.name + "").prop("checked", false);
    }
    else{
       $("#" + c.name + "").prop("checked", true);
    }
    //set mute/unmute
    $("#" + c.name + "").click(function(){
      var self = $(this);
      if(self.is(":checked")){
        c.muted = false;
        if(c.name == "Metronome"){
          metronomeMute = false;
        }
      }
      else{
        c.muted = true;
        if(c.name == "Metronome"){
          metronomeMute = true;
        }
      }
    })
  })
}


function initCanvas(){
  var w =0;
  var h = 0;
  var c = $("<canvas id='canvas' width='" + w + "' height='" + h + "''></canvas>");
  $("#canvasDiv").append(c);
  canvas = document.getElementById("canvas");
  ctx = canvas.getContext("2d");
}

function drawSheet(c){
  canvas.width = max*wSpace + startSpace - hSpace/2;
  canvas.height = hStartSpace+6*hSpace;
  var length = max*wSpace + startSpace;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "black";
  ctx.font = "bold 59px Arial";
  var x = resolution>9? startSpace - 85 : startSpace-55;
  ctx.fillText(resolution, x, 80);
  ctx.fillText(subdivision, startSpace-55, 120);

  //first line
  ctx.strokeStyle = "white";
  ctx.beginPath();
  ctx.moveTo(0,startSpace);
  ctx.lineTo(length,startSpace);
  ctx.stroke();
  ctx.closePath();

  //horizontal lines
  ctx.strokeStyle = "black";
  ctx.beginPath();
  for (var i = 1;i<6;i++){
    ctx.moveTo(0,i*hSpace+hStartSpace);
    ctx.lineTo(length,i*hSpace+hStartSpace);
    ctx.stroke();
  }
  ctx.closePath();
  
  //vertical lines
  for(var i = 0;i<=max;i++){
    
    if(i%resolution == 0){
      ctx.lineWidth = 3;
      ctx.strokeStyle = "black";
    }
    else{
      ctx.lineWidth = 0.5;
      ctx.strokeStyle = "grey";
    }
    ctx.beginPath();
    ctx.moveTo(startSpace - wSpace/2 + i*wSpace,hSpace+hStartSpace);
    ctx.lineTo(startSpace - wSpace/2 + i*wSpace,5*hSpace+hStartSpace);
    ctx.stroke();
    ctx.closePath();
  }
  //cursor line
  ctx.beginPath();
  ctx.lineWidth = 2;
  ctx.moveTo(startSpace - wSpace/2 + (c-1)*wSpace,hStartSpace);
  ctx.lineTo(startSpace - wSpace/2 + (c-1)*wSpace,6*hSpace+hStartSpace);
  ctx.lineTo(startSpace - wSpace/2 + (c)*wSpace,6*hSpace+hStartSpace);
  ctx.lineTo(startSpace - wSpace/2 + (c)*wSpace,hStartSpace);
  ctx.lineTo(startSpace - wSpace/2 + (c-1)*wSpace,hStartSpace);
  ctx.stroke();
  ctx.closePath();
  
  //notes
  commandList.forEach(function(co){
    co.sequenceRepeated.forEach(function(note,i){
      drawNote(ctx,note,i,co.limb.name,co);
    })
  })
}
function drawNote(ctx,note,i,limb,co){
  if(co.muted){
    return
  }
  if(note == "snare" || note == "kick" || note == "highTom" || note == "medTom" || note == "floorTom"){
    drawNoteHead(i,note,limb,isFla(limb,i));
  }
  if(note == "clHiHat" || note == "footHiHat" ){
    drawSmallX(i,note,limb,isFla(limb,i));
  }
  if(note == "opHiHat"){
    drawSmallX(i,note,limb,isFla(limb,i));
    drawEmptyCircle(i,note,limb,isFla(limb,i));
  }
  if(note == "ride"){
    drawBigX(i,note,limb,isFla(limb,i));
  }
}

function drawNoteHead(i,note,limb,fla){
  var x = startSpace + i*wSpace;
  var y = getHeight(note);
  var sc = 0.25;
  var ULx, ULy; // Upper Left corner
  var LLx, LLy; // Lower Left corner
  var URx, URy; // Upper Right corner
  var LRx, LRy; // Lower Right corner
  var CLx, CLy; // Center Left 
  var CRx, CRy; // Center Right

  ULx = x - 30*sc;
  ULy = y - 28*sc;
  URx = x + 30*sc;
  URy = y - 38*sc;

  LLx = x - 30*sc;
  LLy = y + 38*sc;
  LRx = x + 30*sc;
  LRy = y + 28*sc;

  CLx=(ULx+LLx)/2;  // Center Left point
  CLy=(ULy+LLy)/2;
  CRx=(URx+LRx)/2;  // Center Right point
  CRy=(URy+LRy)/2;

  

  // Draw the curves and fill them in:
  ctx.beginPath();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = "black";
  ctx.fillStyle = getColor(limb,fla);
  ctx.moveTo(CLx, CLy);
  ctx.bezierCurveTo(ULx, ULy, URx, URy, CRx, CRy);
  ctx.bezierCurveTo(LRx, LRy, LLx, LLy, CLx, CLy);
  ctx.fill();
  ctx.stroke();
  ctx.closePath();
}
function drawEmptyCircle(i,note,limb,fla){
  ctx.beginPath();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = getColor(limb, false);
  ctx.arc(startSpace + i*wSpace,getHeight(note),noteRadius,0,2*Math.PI);
  ctx.stroke();
  ctx.closePath();
}
function drawBigX(i,note,limb,fla){
  ctx.beginPath();
  ctx.lineWidth = 2;
  ctx.strokeStyle = getColor(limb, false);
  ctx.moveTo(startSpace + i*wSpace - noteRadius ,getHeight(note)-noteRadius);
  ctx.lineTo(startSpace + i*wSpace + noteRadius ,getHeight(note)+noteRadius);
  ctx.stroke();
  if(fla){
    ctx.closePath();
    ctx.beginPath();
    ctx.strokeStyle = getOppositeColor(limb);
  }
  ctx.moveTo(startSpace + i*wSpace - noteRadius ,getHeight(note)+noteRadius);
  ctx.lineTo(startSpace + i*wSpace + noteRadius ,getHeight(note)-noteRadius);
  ctx.stroke();
  ctx.closePath();
}
function drawSmallX(i,note,limb,fla){
  ctx.beginPath();
  ctx.lineWidth = 2;
  ctx.strokeStyle = getColor(limb, false);
  ctx.moveTo(startSpace + i*wSpace - noteRadiusSmall ,getHeight(note)-noteRadiusSmall);
  ctx.lineTo(startSpace + i*wSpace + noteRadiusSmall ,getHeight(note)+noteRadiusSmall);
  ctx.stroke();
  if(fla){
    ctx.closePath();
    ctx.beginPath();
    ctx.strokeStyle = getOppositeColor(limb);
  }
  ctx.moveTo(startSpace + i*wSpace - noteRadiusSmall ,getHeight(note)+noteRadiusSmall);
  ctx.lineTo(startSpace + i*wSpace + noteRadiusSmall ,getHeight(note)-noteRadiusSmall);
  ctx.stroke();
  ctx.closePath();
}
function drawMiddleLine(i,note,limb,fla){
  ctx.beginPath();
  ctx.lineWidth = 1;
  ctx.strokeStyle = "black";
  ctx.moveTo(startSpace + i*wSpace - noteRadius - rideBias ,getHeight(note));
  ctx.lineTo(startSpace + i*wSpace + noteRadius + rideBias ,getHeight(note));
  ctx.stroke();
  ctx.closePath();
}
function isMuted(limb){
  return limb.muted;
}
























