'use strict';

const apiai = require('apiai');
const uuid = require('node-uuid');
const botbuilder = require('botbuilder');
const foodApi = require('./spoonacular');

module.exports = class SkypeBot {

    get apiaiService() {
        return this._apiaiService;
    }

    set apiaiService(value) {
        this._apiaiService = value;
    }

    get botConfig() {
        return this._botConfig;
    }

    set botConfig(value) {
        this._botConfig = value;
    }

    get botService() {
        return this._botService;
    }

    set botService(value) {
        this._botService = value;
    }

    get sessionIds() {
        return this._sessionIds;
    }

    set sessionIds(value) {
        this._sessionIds = value;
    }

    constructor(botConfig) {
        this._botConfig = botConfig;
        var apiaiOptions = {
            language: botConfig.apiaiLang,
            requestSource: "skype"
        };

        this._apiaiService = apiai(botConfig.apiaiAccessToken, apiaiOptions);
        this._sessionIds = new Map();

        this.botService = new botbuilder.ChatConnector({
            appId: this.botConfig.skypeAppId,
            appPassword: this.botConfig.skypeAppSecret
        });

        this._bot = new botbuilder.UniversalBot(this.botService);

        this._bot.dialog('/', (session) => {
            if (session.message && session.message.text) {
                this.processMessage(session);
            }
        });
		
		this._userdishMap = {};
		this._userSelectedDish = {};

    }

    processMessage(session) {
        let messageText = session.message.text;
        let sender = session.message.address.conversation.id;

        if (messageText && sender) {

            console.log(sender, messageText);

            if (!this._sessionIds.has(sender)) {
                this._sessionIds.set(sender, uuid.v1());
            }

            let apiaiRequest = this._apiaiService.textRequest(messageText,
                {
                    sessionId: this._sessionIds.get(sender),
                    originalRequest: {
                        data: session.message,
                        source: "skype"
                    }
                });

            apiaiRequest.on('response', (response) => {
                if (this._botConfig.devConfig) {
                    console.log(sender, "Received api.ai response");
                }
				
				if(response.result.action === "smalltalk.greetings.hello") {
					session.send("Hello!!! I'm your Recipe Bot, you can ask me for different recipes, along with some Nutrition
					information and some info about the substitutes you can use in place of the specified ingredients.
					You can type 'help' if you need any assistance, also you can type \"Recipe of the day\" to know the
					best recipe of that day and can ask crazy questions to know it better :)")
				} else if(response.result.action == "recipe.search"){
					const ingredients = response.result.parameters.Ingredients;
					if(ingredients && ingredients.length >0) {
						session.send("Looking for grandma recipe books")
						foodApi.getIngredients(ingredients.join(","), 4)
						.then(recipes => {
							if(recipes.length >0) {
								this._userdishMap[sender] = this._userdishMap[sender] ? this._userdishMap[sender].concat(recipes) : recipes;
								this.respondWithCarousel(session, recipes)
							} else {
								session.send("No recipes found for these ingredients");
							}
							session.endDialog();
						})
						.catch(e => this.respondError(session))
					} else {
						session.send("Unable to find out any ingredients");
						session.endDialog();
					}
				} else if(response.result.action === "recipe.random") {
					const tag = response.result.parameters.tags;
				
					if(tags) {
						
					}
				} else if(response.result.action === "substitute.ingredient") {
					const ingredients = response.result.parameters.Ingredients;
					if(ingredients && ingredients.length >0) {
						session.send("Looking for substitutes..")
							foodApi.getSubstitutes(ingredients[0])
						.then(data => {
							if(data.substitutes.length > 0) {
								var rs = data.substitutes;
								if(rs.length >2) rs = rs.slice(0,2);
								rs.map(i => {
									var i1 = i.split("=");
									session.send("You can substitute " + i1[0] + " of "+ ingredients[0] + " with " + i1[1]);
								});
							} else {
								session.send("No substitute found for " + ingredients[0]);
							} 
							session.endDialog();
						})
						.catch(e => this.respondError(session))
					} else {
						session.send("There is nothing that I can think of");
						session.endDialog();
					}
					
				} else if(response.result.action === "dish.selected") {
					const dishQuery = response.result.resolvedQuery;
					const selectedStr = "Nice choice! You have chosen ";
					const dish = dishQuery.replace(/Nice choice! You have chosen /g, '');
					var userRecipes = this._userdishMap[sender];
					var selectedDish = userRecipes.find(x => x.title == dish);
					if(selectedDish) {
						this._userSelectedDish[sender] = selectedDish;
						botbuilder.Prompts.confirm(session, 'Do you want to see the recipe?', {listStyle: botbuilder.ListStyle["button"]});
					} else {
						session.send("Sorry we cannot find that dish");
					}
					session.endDialog();
				} else if(response.result.action == "smalltalk.confirmation.yes") {
					if(this._userSelectedDish[sender]) {
						session.send("Getting the recipe for " + this._userSelectedDish[sender].title );
						foodApi.getProcedure(this._userSelectedDish[sender].id).then(function(d){
							d[0].steps.map(s => {
								session.send(s.step)
							})
							session.send("There you go!")
							session.endDialog();
						})

					} else {
						session.send("Sorry we cannot find that dish");
					}
			} else if(response.result.action == "generic.queries" || response.result.action == "nutrients.answer") {
					foodApi.getAnswer(response.result.resolvedQuery).then(function(d){
							console.log(d                                               );
							d.answer? session.send(d.answer) : session.send("No idea")
							session.endDialog();
						}).catch(e => this.respondError(session));
			
				} else if (SkypeBot.isDefined(response.result) && SkypeBot.isDefined(response.result.fulfillment)) {
                    let responseText = response.result.fulfillment.speech;
                    let responseMessages = response.result.fulfillment.messages;
				
					
					console.log(responseText, responseMessages);
                    if (SkypeBot.isDefined(responseMessages) && responseMessages.length > 0) {
                        this.doRichContentResponse(session, responseMessages);
                    } else if (SkypeBot.isDefined(responseText)) {
                        console.log(sender, 'Response as text message');
                        session.send(responseText);

                    } else {
                        console.log(sender, 'Received empty speech');
                    }
                } else {
                    console.log(sender, 'Received empty result');
                }
            });

            apiaiRequest.on('error', (error) => {
                console.error(sender, 'Error while call to api.ai', error);
            });

            apiaiRequest.end();
        } else {
            console.log('Empty message');
        }
    }
	
	respondError(session) {
		session.send("do you want to look for some other Recipe and i can help you with other good stuff");
		session.send("<ss type =\"wink\">;)</ss>");
		session.endDialog();
	}
	
	respondWithCarousel(session, data) {
		var msg = new botbuilder.Message(session)
            .textFormat(botbuilder.TextFormat.xml)
            .attachmentLayout(botbuilder.AttachmentLayout.carousel)
            .attachments(data.map(r => new botbuilder.HeroCard(session)
                    .title(r.title)
                    .images([
                        botbuilder.CardImage.create(session, r.image)
                    ])
                    .buttons([
                        botbuilder.CardAction.imBack(session, "Nice choice! You have chosen " + r.title, "Select")
                    ])));
					//botbuilder.Prompts.choice(session, msg, data.map(r => r.title).join("|"));
					session.send(msg);
	}

    doRichContentResponse(session, messages) {

        for (let messageIndex = 0; messageIndex < messages.length; messageIndex++) {
            let message = messages[messageIndex];

            switch (message.type) {
                //message.type 0 means text message
                case 0:
                    {

                        if (SkypeBot.isDefined(message.speech)) {
                            session.send(message.speech);
                        }

                    }

                    break;

                    //message.type 1 means card message
                case 1:
                    {
                        let heroCard = new botbuilder.HeroCard(session).title(message.title);

                        if (SkypeBot.isDefined(message.subtitle)) {
                            heroCard = heroCard.subtitle(message.subtitle)
                        }

                        if (SkypeBot.isDefined(message.imageUrl)) {
                            heroCard = heroCard.images([botbuilder.CardImage.create(session, message.imageUrl)]);
                        }

                        if (SkypeBot.isDefined(message.buttons)) {

                            let buttons = [];

                            for (let buttonIndex = 0; buttonIndex < message.buttons.length; buttonIndex++) {
                                let messageButton = message.buttons[buttonIndex];
                                if (messageButton.text) {
                                    let postback = messageButton.postback;
                                    if (!postback) {
                                        postback = messageButton.text;
                                    }

                                    let button;

                                    if (postback.startsWith("http")) {
                                        button = botbuilder.CardAction.openUrl(session, postback, messageButton.text);
                                    } else {
                                        button = botbuilder.CardAction.postBack(session, postback, messageButton.text);
                                    }

                                    buttons.push(button);
                                }
                            }

                            heroCard.buttons(buttons);

                        }

                        let msg = new botbuilder.Message(session).attachments([heroCard]);
                        session.send(msg);

                    }

                    break;

                    //message.type 2 means quick replies message
                case 2:
                    {

                        let replies = [];

                        let heroCard = new botbuilder.HeroCard(session).title(message.title);

                        if (SkypeBot.isDefined(message.replies)) {

                            for (let replyIndex = 0; replyIndex < message.replies.length; replyIndex++) {
                                let messageReply = message.replies[replyIndex];
                                let reply = botbuilder.CardAction.postBack(session, messageReply, messageReply);
                                replies.push(reply);
                            }

                            heroCard.buttons(replies);
                        }

                        let msg = new botbuilder.Message(session).attachments([heroCard]);
                        session.send(msg);

                    }

                    break;

                    //message.type 3 means image message
                case 3:
                    {
                        let heroCard = new botbuilder.HeroCard(session).images([botbuilder.CardImage.create(session, message.imageUrl)]);
                        let msg = new botbuilder.Message(session).attachments([heroCard]);
                        session.send(msg);
                    }

                    break;

                default:

                    break;
            }
        }

    }

    static isDefined(obj) {
        if (typeof obj == 'undefined') {
            return false;
        }

        if (!obj) {
            return false;
        }

        return obj != null;
    }
}