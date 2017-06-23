var axios = require('axios');

var SA = {};

SA.getProcedure = function(id){
	var params = {stepBreakdown:true}
	return axios({
		method : "GET", 
		url: "https://spoonacular-recipe-food-nutrition-v1.p.mashape.com/recipes/"+id+"/analyzedInstructions", 
		params: params,
		headers: {
			"X-Mashape-Key" : process.env.SPOONACULAR_TOKEN,
			//"Content-Type" : "application/x-www-form-urlencoded"
		}})
		.then(function(d) {console.log(d.data);return d.data})
}

SA.getAutocomplete = function(id){
	var params = {metaInformation:false,number:10,query:"appl"}
	return axios({
		method : "GET", 
		url: "https://spoonacular-recipe-food-nutrition-v1.p.mashape.com/food/ingredients/autocomplete", 
		params: params,
		headers: {
			"X-Mashape-Key" : process.env.SPOONACULAR_TOKEN,
		}})
		.then(function(d) {console.log(d.data);return d.data})
};

SA.getSubstitutes = function(ingredient){
	var params = {ingredientName :  ingredient}
	return axios({
		method : "GET", 
		url: "https://spoonacular-recipe-food-nutrition-v1.p.mashape.com/food/ingredients/substitutes", 
		params: params,
		headers: {
			"X-Mashape-Key" : process.env.SPOONACULAR_TOKEN,
		}})
		.then(function(d) {console.log(d.data);return d.data}).catch(e => console.log(e));
};

SA.getIngredients = function getIngredients(ingredients, count){
	var params = {fillIngredients:true,ingredients:ingredients,limitLicense:false,number:count,ranking:1}
	return axios({
		method : "GET", 
		url: "https://spoonacular-recipe-food-nutrition-v1.p.mashape.com/recipes/findByIngredients", 
		params: params,
		headers: {
			"X-Mashape-Key" : process.env.SPOONACULAR_TOKEN,
		}})
		.then(function(d) {return d.data}).catch(e => console.log(e));
}


SA.getAnswer = function getAnswer(query){
	var params = {q: query}
	return axios({
		method : "GET", 
		url: "https://spoonacular-recipe-food-nutrition-v1.p.mashape.com/recipes/quickAnswer", 
		params: params,
		headers: {
			"X-Mashape-Key" : process.env.SPOONACULAR_TOKEN,
		}})
		.then(function(d) {return d.data})
}

module.exports = SA;