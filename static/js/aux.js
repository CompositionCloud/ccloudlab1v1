/*global window, scores, score_types*/

/*jslint es6, for, node*/

const aux = (function aux_() {
    "use strict";

    function sumArray(i, array) {
        let sum = 0;

        array.forEach(function addItem(item, index) {
            if (index < i) {
                sum += item;
            }
        });

        return sum;
    }
    
    function randomSequence(length) {
        const array1 = [];
        const array2 = [];
        
        let i;
        
        for (i = 0; i < length; i += 1) {
            array1.push(i);
        }

        for (i = length; i > 0; i -= 1) {
            array2.push(array1.splice(Math.floor(Math.random() * i), 1)[0]);
        }

        return array2;
    }
    
    function eventsToLog(performer) {
        let log = score_types[scores[performer.current_event.score].type].write(performer, "current_event") + ": ";

        let i;

        for (i = 1; i <= 3; i += 1) {
            if (performer["next_event_" + i] !== "[]") {
                log += score_types[scores[performer["next_event_" + i].score].type].write(performer, "next_event_" + i) + ": ";
            } else {
                log += "[]: ";
            }
        }

        log += performer.next_event_index + ": " + performer.general_loudness;
        
        return log;
    }

    function logToEvents(performer, log) {
        log = log.split(": ");
        
        let i;
        
        log[0] = log[0].split(":");
        
        performer.current_event = {score: parseInt(log[0][0])};

        score_types[scores[parseInt(log[0][0])].type].read(performer, "current_event", log[0][1].split(","));
        
        for (i = 1; i <= 3; i += 1) {
            const next_event = "next_event_" + i;
            
            if (log[i] !== "[]") {
                log[i] = log[i].split(":");

                performer[next_event] = {score: parseInt(log[i][0])};
                    
                score_types[scores[parseInt(log[i][0])].type].read(performer, next_event, log[i][1].split(","));
            } else {
                performer[next_event] = "[]";
            }
        }
        
        performer.next_event_index = parseInt(log[4]);
        
        performer.general_loudness = parseFloat(log[5]);
    }
    
    function loadMedia(from, to, path, audio, init) {
        (function load(i) {
            if (i <= to) {
                if (scores[i].image) {
                    const image_name = scores[i].image;

                    scores[i].image = new Image();
                    scores[i].image.src = path + "images/" + image_name;
                    
                    scores[i].image.onload = function onloadImage() {
                        load(i + 1);
                    };
                } else if (audio && scores[i].audio) {
                    if (scores[i].audio.length === 4) {
                        let j;
                        
                        for (j = 0; j < 4; j += 1) {
                            scores[i].audio[j] = new Audio(path + "audio/" + scores[i].audio[j]);
                            scores[i].audio[j].loop = true;
                        }
                    } else {
                        scores[i].audio = new Audio(path + "audio/" + scores[i].audio);
                        scores[i].audio.loop = true;
                    }
                    
                    load(i + 1);
                } else {
                    load(i + 1);
                }
            } else {
                init();
            }
        }(from));
    }
    
    function choosePerformer() {
        let performer_index;

        do {
            performer_index = window.prompt(
                "*** CHOOSE A PERFORMER ***" + "\n\n" +
                "1. Amit Dubester" + "\n" +
                "2. Francesca Naibo" + "\n" +
                "3. Oded Geizhals" + "\n\n" +
                "Type a number between 1 and 3 and click \"OK\"."
            );
            
            if (performer_index !== "monitor") {
                performer_index = parseInt(performer_index);
            } else {
                break;
            }
            
        } while (performer_index < 1 || performer_index > 3);
        
        return performer_index;
    }
        
    return {
        sumArray: sumArray,
        randomSequence: randomSequence,
        eventsToLog: eventsToLog,
        logToEvents: logToEvents,
        loadMedia: loadMedia,
        choosePerformer: choosePerformer
    };
}());

if (typeof exports !== "undefined") {
    exports.aux = aux;
    
    const path = require("path");
    
    scores = require(path.join(__dirname, "/scores.js")).scores;
    score_types = require(path.join(__dirname, "/types.js")).score_types;

}