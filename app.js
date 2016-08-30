var restify = require("restify");
var builder = require("botbuilder");

//=========================================================
// Bot Setup
//=========================================================


// Setup Restify Server
var server = restify.createServer();
server.use(restify.bodyParser());
server.use(restify.jsonp());
server.listen(process.env.port || process.env.PORT || 3978, function () {
   console.log('%s listening to %s', server.name, server.url); 
});

var profileInfo = {}
var surveydata = null
var profileQtObj;
// Create chat bot
var botConnectorOptions = { 
    appId: process.env.BOTFRAMEWORK_APPID, 
    appPassword: process.env.BOTFRAMEWORK_APPSECRET
};
var connector = new builder.ChatConnector(botConnectorOptions);
var bot = new builder.UniversalBot(connector);
server.post('/api/messages', connector.listen());

server.post('/pushsurvey', function respond(req, res, next) {
	var filteredUsers = filterUsers(profileInfo)
	surveydata = req.body;
 	for (var key in filteredUsers) {
		if (filteredUsers.hasOwnProperty(key)) {
			console.log(key + " -> " + JSON.stringify(filteredUsers[key]));
			bot.beginDialog(filteredUsers[key].address, '/notify');
		}
	}
 	res.send('Sent survey requests to end users::'+JSON.stringify(req.body));
});

//=========================================================
// Activity Events
//=========================================================

bot.on('conversationUpdate', function (message) {
   // Check for group conversations
    if (message.address.conversation.isGroup) {
        // Send a hello message when bot is added
        if (message.membersAdded) {
            message.membersAdded.forEach(function (identity) {
                if (identity.id === message.address.bot.id) {
                    var reply = new builder.Message()
                            .address(message.address)
                            .text("Hello everyone!");
                    bot.send(reply);
                }
            });
        }

        // Send a goodbye message when bot is removed
        if (message.membersRemoved) {
            message.membersRemoved.forEach(function (identity) {
                if (identity.id === message.address.bot.id) {
                    var reply = new builder.Message()
                        .address(message.address)
                        .text("Goodbye");
                    bot.send(reply);
                }
            });
        }
    }
});

bot.on('contactRelationUpdate', function (message) {
    if (message.action === 'add') {
        bot.beginDialog(session, '/profileInfo');
    } else {
        //deleteProfileInfo(message.user.id)
    }
});


// Bot Dialogs
bot.dialog('/', [
	function(session) {
		session.beginDialog('/profileInfo')
    }
]);


bot.dialog('/profileInfo', [
	function(session) {
		var user_id = session.message.user.id
		if(!profileInfo[user_id]) {
			profileInfo[user_id] = {}
			session.beginDialog('/gatherProfileInfo')
		} else {
			if(profileInfo[user_id]["infoGathered"]) {
				session.send(JSON.stringify(profileInfo[user_id]))
			} else {
				session.beginDialog('/gatherProfileInfo')
			}
		}
	}
])

bot.dialog('/gatherProfileInfo', [
	function(session) {
		profileInfo[session.message.user.id]["address"] = session.message.address; 
		builder.Prompts.number(session, 'Hello... Thanks for adding me into your contacts. Please fill out the basic profile info. <br> What is your age?');
	},
	function(session, results) {
		profileInfo[session.message.user.id]["age"] = results.response;
		builder.Prompts.choice(session, 'What is your Gender?', ["Male","Female","Other"]);
    },
    function(session, results) {
		profileInfo[session.message.user.id]["gender"] = results.response.entity;
		builder.Prompts.confirm(session, "Are you Married?");   
	}, 
    function (session, results) {
		profileInfo[session.message.user.id]["maritalstatus"] = results.response;
		builder.Prompts.text(session, "Please enter your email id?");
	}, 
    function (session, results) {
		profileInfo[session.message.user.id]["email"] = results.response;
		builder.Prompts.text(session, "What is your current residing city?");
	},
	function (session, results) {
		profileInfo[session.message.user.id]["city"] = results.response; 
		profileInfo[session.message.user.id]["infoGathered"] = "true";
		//saveUserInfo(profileInfo[session.message.user.id])
		session.endDialog(JSON.stringify(profileInfo[session.message.user.id]));
	}
]);


bot.dialog('/notify', [
	function(session) {
		builder.Prompts.confirm(session, "We have a new Profile Survey.Do you want to participate?");
	},
	function (session, results) {
		if(results.response){
			session.userData.questionId = 0;
			session.userData.response = [];
			profileQtObj = surveydata;
			session.beginDialog('/survey');
		} else {
			session.endDialog("Thank You for your time :)");
		}
	}
]);

bot.dialog('/survey', [
    function (session) {
        if (!session.userData.questionId) {
            session.userData.questionId = 0;
        } 
        if (session.userData.questionId < profileQtObj.survey.length) {
            askQuestion(session);
        } else {
            var txt = ""; 
            //Or save the backing store..
            session.userData.response.forEach(function(response) {
                txt += "\n\n";
                txt += "---\n\n";
                txt += "**Question : " + profileQtObj.survey[response.questionId].question + "**";
                txt += "\n\n";
                if(profileQtObj.survey[response.questionId].type == 'multi') {
                    txt += " Answer : " + response.result.entity;
                } else {
                    txt += " Answer : " + response.result;
                }
                txt += "\n\n";   
            }, this);
            session.userData = null;
            var endMsg = "Thank you for your time and patience. Your survey response : " + txt;
            session.endDialog(endMsg);
        }
    },
    function (session, results) {        
        if(!session.userData.response) {
            session.userData.response = [];
        }
        session.userData.response.push({questionId : session.userData.questionId, result: results.response});
        session.userData.questionId = session.userData.questionId + 1;
        session.replaceDialog('/survey');
    }
]);

//=========================================================
// User Functions
//=========================================================

function askQuestion(session) {
    var index = session.userData.questionId;
    if(profileQtObj.survey[index].type === 'multi') {
        builder.Prompts.choice(session, profileQtObj.survey[index].question, profileQtObj.survey[index].choices);
    } else if (profileQtObj.survey[index].type === 'bool') {
        builder.Prompts.confirm(session, profileQtObj.survey[index].question);
    } else if (profileQtObj.survey[index].type === 'text') {
        builder.Prompts.text(session, profileQtObj.survey[index].question);
    }
}

/**
Returns list of end users after filtering
**/
function filterUsers(profileInfo) {
	return profileInfo
}
