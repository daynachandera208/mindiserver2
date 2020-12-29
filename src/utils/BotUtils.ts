import { MapSchema, ArraySchema } from '@colyseus/schema';
import { CPlayer } from '../state/CPlayer';
import { CCard } from '../state/CCard';
import { Team } from '../state/Team';

export class BotUtils {

    suits = [
		'Heart',
		'Spade',
		'Club',
		'Diamond'
    ];
    
    noSuitCards: MapSchema<string> = new MapSchema<string>();

    lowSuitCards: MapSchema<string> = new MapSchema<string>();

    teamA: Team;

    teamB: Team;

    bots: MapSchema<CPlayer> = new MapSchema<CPlayer>();

    jokerActive: boolean = false;

    trumpActive: boolean = false;

    trump: string = '';

    playerCount: number = 0;

    curRoundPlayedPlayers: string[] = [];

    roundsCompleted: number = 0;

    jokerSuit: string = 'Joker';

    mode: string;

    remainingCards: MapSchema<CCard> = new MapSchema<CCard>();

    resetBotData() {
        this.noSuitCards = new MapSchema<string>();
        this.lowSuitCards = new MapSchema<string>();
        this.teamA = null;
        this.teamB = null;
        this.jokerActive = false;
        this.trumpActive = false;
        this.trump = '';
        this.playerCount = 0;
        this.curRoundPlayedPlayers = [];
        this.roundsCompleted = 0;
        this.remainingCards  = new MapSchema<CCard>();
    }

    makeId(length) {
        var result           = '';
        var characters       = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        var charactersLength = characters.length;
        for ( var i = 0; i < length; i++ ) {
           result += characters.charAt(Math.floor(Math.random() * charactersLength));
        }
        return result;
     }

    addBot = (sessionId: string, player: CPlayer) => {
        this.bots[sessionId] = player;
    }

    isBotTurn = (curPlayerSeat: number) : boolean => {
        for(let id in this.bots) {
            if(this.bots[id].seat === curPlayerSeat)
                return true;
        }
        return false;
    }

    removeFromRemainingCards(card: CCard) {
        let cards: ArraySchema<CCard> = new ArraySchema<CCard>();
        let botCs: ArraySchema<CCard> = this.remainingCards[card.suit];
        for(let i = 0; i < botCs.length; i++) {
            if(botCs[i].number !== card.number || botCs[i].suit !== card.suit) {
                cards.push(botCs[i]);
            }
        }
        this.remainingCards[card.suit] = cards;
    }

    chooseHideCard = (sessionId: string) : CCard => {
        return this.getRandomCard(sessionId);
    }

    getRandomCard(sessionId: string) : CCard {
        let player: CPlayer = this.bots[sessionId];
        let ids: string[] = Object.keys(player.cards);
        let randomeSuit: number = -1;
        let cards : ArraySchema<CCard>;
        do {
            randomeSuit = Math.floor(Math.random() * ids.length);
            cards = player.cards[ids[randomeSuit]];
        }
        while(!cards || cards.length == 0);

        let randomCard = Math.floor( Math.random() * cards.length);
        console.log(`Returning RandomCard = ${cards[randomCard]}`);
        return cards[randomCard];
    }

    getRandomSuitCard(sessionId: string, suit: string) : CCard {
        let player: CPlayer = this.bots[sessionId];
        let cards : ArraySchema<CCard> = player.cards[suit];
        let randomCard = Math.floor( Math.random() * cards.length);
        return cards[randomCard];
    }

    removeBotCard(sessionId: string, card: CCard) {
        let player = this.bots[sessionId];

        let cs: ArraySchema<CCard> = player.cards[card.suit];
        for(let i = 0; i < cs.length; i++) {
            if(cs[i].number === card.number && cs[i].suit === card.suit) {
                player.cards[card.suit].splice(i, 1);
                break;
            }
        }
    }

    determinHighCard = (roundCards: ArraySchema<CCard>) : CCard => {		
		let highCard: CCard = null;

		// If joker included, check for joker
		if(this.jokerActive) {
			roundCards.forEach(card => {
				if(card.number == 0) {
					highCard = card;
				}
			});

			if(highCard != null) {
				return highCard;
			}
		}

		let highNum: number = 0;
		// If trump is active, find highest trump
		if(this.trumpActive) {
			roundCards.forEach(card => {
				if(card.suit == this.trump && card.number >= highNum) {
					highNum = card.number;
					highCard = card;
				}
			});

			if(highCard != null) {
				return highCard;
			}
		}

		// check high card in all played cards
		highCard = roundCards[0];
		for(let i = 1; i < roundCards.length; i++) {
			if(highCard.suit == roundCards[i].suit && roundCards[i].number >= highCard.number) {
				highCard = roundCards[i];
			}
		}

		return highCard;
    }

    // Logic is pulled from client side Bot.cs file
    getBotTurnCard = (sessionId: string, roundCards: ArraySchema<CCard>) : CCard => {
        
        if(roundCards) {
            roundCards.forEach(card => {
                this.curRoundPlayedPlayers.push(card.playerSessionId);
            });
        }

        let playedCard: CCard = null;

        if (roundCards.length == 0) {

            playedCard = this.trumpActive ? this.firstTurnAfterTrump(sessionId) : this.firstTurnBeforeTrump(sessionId);
        }
        else {
            if (roundCards.length < this.playerCount - 1) {
                playedCard = this.trumpActive ? this.middleTurnAfterTrump(sessionId, roundCards) : this.middleTurnBeforeTrump(sessionId, roundCards);
            }
            else {
                playedCard = this.trumpActive ? this.lastTurnAfterHakam(sessionId, roundCards) : this.lastTurnBeforeHakam(sessionId, roundCards);
            }
        }

        if(!playedCard)
            playedCard = this.getRandomCard(sessionId);
        return playedCard;
    }

    middleTurnAfterTrump(sessionId: string, roundCards: ArraySchema<CCard>) : CCard {
        let followSuit: string = roundCards[0].suit;
        let maxCard: CCard = this.determinHighCard(roundCards);
        let mustFollowSuit: boolean = this.hasThisSuitCard(sessionId, followSuit);

        let myMaxCard: CCard = null;
        if (mustFollowSuit) {
            myMaxCard = this.getMaxCardOf(sessionId, followSuit);
        }
        else {
            if(!this.noSuitCards[sessionId]) {
                this.noSuitCards[sessionId] = followSuit;
            }
        }

        if (maxCard.suit === this.trump) {
            if (maxCard.number > this.getMaxCardFromRemainingCards(this.trump)) {
                if (this.isMyPartner(sessionId, maxCard.playerSessionId))
                {
                    let mindi: CCard = this.getMindi(sessionId, followSuit, mustFollowSuit);
                    if (mindi)
                        return mindi;
                }

                if (mustFollowSuit) {
                    return this.getMinCardNotMindiOf(sessionId, followSuit);
                }
                else if (this.hasThisSuitCard(sessionId, this.trump)) {
                    let maxThanCard: CCard = this.getMaxCardThan(sessionId, maxCard);
                    if (maxThanCard)
                        return maxThanCard;
                }

                return this.getLowestCardNotMindi(sessionId);
            }

            let enemyCutId: string = this.enemyCut(followSuit, sessionId, sessionId);
            if (enemyCutId == null) {
                if (this.isMyPartner(sessionId, maxCard.playerSessionId)) {
                    let mindi: CCard = this.getMindi(sessionId, followSuit, mustFollowSuit);
                    if (mindi)
                        return mindi;
                    else if (mustFollowSuit)
                        return this.getMinCardNotMindiOf(sessionId, followSuit);
                    else
                        return this.getLowestCardNotMindi(sessionId);

                }

                let partnerCutId: string = this.partnerCut(followSuit, sessionId, sessionId);
                if (partnerCutId != null) {
                    let mindi: CCard = this.getMindi(sessionId, followSuit, mustFollowSuit);
                    if (mindi)
                        return mindi;
                    else if (mustFollowSuit)
                        return this.getMinCardNotMindiOf(sessionId, followSuit);
                    else
                        return this.getLowestCardNotMindi(sessionId);
                }

                if (mustFollowSuit) {
                    return this.getMinCardNotMindiOf(sessionId, followSuit);
                }
                else if (this.hasThisSuitCard(sessionId, this.trump)) {
                    let trumpCard: CCard = this.getMaxCardOf(sessionId, this.trump);
                    if (trumpCard && trumpCard.number >= maxCard.number)
                    {
                        let maxThanCard: CCard = this.getMaxCardThan(sessionId, maxCard);
                        if (maxThanCard)
                            return maxThanCard;
                    }
                }

                if (mustFollowSuit)
                    return this.getMinCardNotMindiOf(sessionId, followSuit);
                else
                    return this.getLowestCardNotMindi(sessionId);
            }
         
            if (this.partnerCut(followSuit, enemyCutId, sessionId) != null) {        
                let mindi: CCard = this.getMindi(sessionId, followSuit, mustFollowSuit);
                if (mindi)
                    return mindi;
                else if (mustFollowSuit)
                    return this.getMinCardNotMindiOf(sessionId, followSuit);
                else
                    return this.getLowestCardNotMindi(sessionId);
            }
        
            if (this.roundCardsContainMindi(roundCards)) {
                if (mustFollowSuit) {
                    if (this.hasJoker(sessionId))
                        return this.getRandomSuitCard(sessionId, this.jokerSuit);

                    return this.getMinCardNotMindiOf(sessionId, followSuit);
                }
                else if(this.hasThisSuitCard(sessionId, this.trump)) {
                    let maxThanCard: CCard = this.getMaxCardThan(sessionId, maxCard);
                    if (maxThanCard)
                        return maxThanCard;

                    if (this.hasJoker(sessionId))
                        return this.getRandomSuitCard(sessionId, this.jokerSuit);
                }
            }

            if (mustFollowSuit) {
                return this.getMinCardNotMindiOf(sessionId, followSuit);
            }
            else if (this.hasThisSuitCard(sessionId, this.trump)) {
                let trumpCard: CCard = this.getMaxCardOf(sessionId, this.trump);
                if (trumpCard)                
                    return trumpCard;                
            }
       
            if (mustFollowSuit)
                return this.getMinCardNotMindiOf(sessionId, followSuit);
            else
                return this.getLowestCardNotMindi(sessionId);
        }
        else if (maxCard.number !== 0) {
            if (maxCard.number > this.getMaxCardFromRemainingCards(followSuit)) {
                if (this.enemyCut(followSuit, sessionId, sessionId) == null) {
                    if (this.isMyPartner(sessionId, maxCard.playerSessionId)) {
                        let mindi: CCard = this.getMindi(sessionId, followSuit, mustFollowSuit);
                        if (mindi && maxCard.number > this.getMaxCardFromRemainingCards(followSuit))
                            return mindi;
                        else if (mustFollowSuit)
                            return this.getMinCardNotMindiOf(sessionId, followSuit);
                        else
                            return this.getLowestCardNotMindi(sessionId);
                    }

                    if (this.roundCardsContainMindi(roundCards)) {
                        if (mustFollowSuit) {
                            if (myMaxCard.number >= maxCard.number)
                                return myMaxCard;
                        }
                        else if (this.hasThisSuitCard(sessionId, this.trump)) {
                            let trumpCard: CCard = this.getMinCardOf(sessionId, this.trump);
                            if (trumpCard)
                                return trumpCard;
                        }

                        if (this.hasJoker(sessionId))
                            return this.getRandomSuitCard(sessionId, this.jokerSuit);
                    }

                    if (mustFollowSuit) {
                        if (myMaxCard.number >= maxCard.number)
                            return myMaxCard;
                    }
                    else if (this.hasThisSuitCard(sessionId, this.trump)) {
                        let trumpCard: CCard = this.getMinCardOf(sessionId, this.trump);
                        if (trumpCard)
                            return trumpCard;
                    }
                }

                if (this.roundCardsContainMindi(roundCards)) {
                    if (mustFollowSuit) {
                        if (this.hasJoker(sessionId))
                            return this.getRandomSuitCard(sessionId, this.jokerSuit);

                        return this.getMinCardOf(sessionId, followSuit);
                    }
                    else if (this.hasThisSuitCard(sessionId, this.trump)) {
                        let trumpCard: CCard = this.getMaxCardOf(sessionId, this.trump);
                        if (trumpCard)
                            return trumpCard;
                    }
                }

                if (mustFollowSuit) {
                    if (myMaxCard.number >= maxCard.number)
                        return myMaxCard;
                }
                else if (this.hasThisSuitCard(sessionId, this.trump)) {
                    let trumpCard = this.getMaxCardOf(sessionId, this.trump);
                    if (trumpCard && trumpCard.number >= this.getMaxCardFromRemainingCards(this.trump))
                        return trumpCard;

                    let card11: CCard = new CCard();
                    card11.number = 10;
                    card11.suit = this.trump;
                    let maxThanMindi: CCard = this.getMaxCardThan(sessionId, card11);
                    if (maxThanMindi)
                        return maxThanMindi;
                }

                if (mustFollowSuit)
                    return this.getMinCardNotMindiOf(sessionId, followSuit);
                else
                    return this.getLowestCardNotMindi(sessionId);
            }

            let enemyCutId: string = this.enemyCut(followSuit, sessionId, sessionId);

            if (enemyCutId == null) {
                if (this.partnerCut(followSuit, sessionId, sessionId) != null) {
                    let mindi: CCard = this.getMindi(sessionId, followSuit, mustFollowSuit);
                    if (mindi)
                        return mindi;
                    else if (mustFollowSuit)
                        return this.getMinCardNotMindiOf(sessionId, followSuit);
                    else
                        return this.getLowestCardNotMindi(sessionId);
                }

                if (this.roundCardsContainMindi(roundCards)) {
                    if (mustFollowSuit) {
                        if (myMaxCard.number >= maxCard.number)
                            return myMaxCard;
                    }
                    else if (this.hasThisSuitCard(sessionId, this.trump)) {
                        let trumpCard: CCard = this.getMinCardOf(sessionId, this.trump);
                        if (trumpCard)
                            return trumpCard;
                    }

                    if (this.hasJoker(sessionId))
                        return this.getRandomSuitCard(sessionId, this.jokerSuit);
                }

                if (maxCard.number < 9) {
                    let card11: CCard = new CCard();
                    card11.number = 10;
                    card11.suit = followSuit;
                    let maxThanMindi: CCard = this.getMaxCardThan(sessionId, card11);
                    if (maxThanMindi)
                        return maxThanMindi;
                }
            }

            if (this.partnerCut(followSuit, enemyCutId, sessionId) != null) {
                let mindi: CCard = this.getMindi(sessionId, followSuit, mustFollowSuit);
                if (mindi)
                    return mindi;
                else {
                    if (mustFollowSuit)
                        return this.getMinCardNotMindiOf(sessionId, followSuit);
                    else
                        return this.getLowestCardNotMindi(sessionId);
                }
            }

            if (this.roundCardsContainMindi(roundCards)) {
                if (mustFollowSuit) {
                    if (myMaxCard.number >= maxCard.number)
                        return myMaxCard;
                }
                else if (this.hasThisSuitCard(sessionId, this.trump)) {
                    let trumpCard: CCard = this.getMaxCardOf(sessionId, this.trump);
                    if (trumpCard && trumpCard.number >= this.getMaxCardFromRemainingCards(this.trump))
                        return trumpCard;
                    else if (this.hasJoker(sessionId))
                        return this.getRandomSuitCard(sessionId, this.jokerSuit);
                }

                if (this.hasJoker(sessionId))
                    return this.getRandomSuitCard(sessionId, this.jokerSuit);
            }

            if (mustFollowSuit) {
                if (myMaxCard.number >= maxCard.number) {
                    let maxThanCard: CCard = this.getMaxCardThan(sessionId, maxCard);
                    if (maxThanCard && maxThanCard.number !== 9)
                        return maxThanCard;
                    else
                        return this.getMinCardNotMindiOf(sessionId, followSuit);
                }
            }
            else if (this.hasThisSuitCard(sessionId, this.trump)) {
                let card11: CCard = new CCard();
                    card11.number = 10;
                    card11.suit = this.trump;
                let maxThanMindi: CCard = this.getMaxCardThan(sessionId, card11);
                if (maxThanMindi)
                    return maxThanMindi;
            }

            if (mustFollowSuit)
                return this.getMinCardNotMindiOf(sessionId, followSuit);
            else
                return this.getLowestCardNotMindi(sessionId);
        }
        else {
            if (this.isMyPartner(sessionId, maxCard.playerSessionId)) {
                let mindi: CCard = this.getMindi(sessionId, followSuit, mustFollowSuit);
                if (mindi)
                    return mindi;
                else if (mustFollowSuit)
                    return this.getMinCardOf(sessionId, followSuit);
                else
                    return this.getLowestCardNotMindi(sessionId);
            }

            if (this.hasJoker(sessionId))
                return this.getRandomSuitCard(sessionId, this.jokerSuit);

            if (mustFollowSuit)
                return this.getMinCardNotMindiOf(sessionId, followSuit);
            else
                return this.getLowestCardNotMindi(sessionId);
        }
    }

    middleTurnBeforeTrump(sessionId: string, roundCards: ArraySchema<CCard>) : CCard {
        let firstSuitPlayed: string = roundCards[0].suit;
        let maxCard: CCard = this.determinHighCard(roundCards);
        if (this.hasThisSuitCard(sessionId, firstSuitPlayed)) {
            let myMaxCard: CCard = this.getMaxCardOf(sessionId, firstSuitPlayed);

            if (!this.isMyPartner(sessionId, maxCard.playerSessionId)) {
                if (maxCard.number === 0) {
                    if (this.hasJoker(sessionId))
                        return this.getRandomSuitCard(sessionId, this.jokerSuit);
                    else
                        return this.getMinCardNotMindiOf(sessionId, firstSuitPlayed);
                }

                if (this.roundCardsContainMindi(roundCards)) {
                    if (myMaxCard.number >= maxCard.number && myMaxCard.number > this.getMaxCardFromRemainingCards(firstSuitPlayed))
                        return myMaxCard;

                    if (this.hasJoker(sessionId))
                        return this.getRandomSuitCard(sessionId, this.jokerSuit);
                }

                if (maxCard.number < 9) {
                    let card11: CCard = new CCard();
                    card11.number = 10;
                    card11.suit = firstSuitPlayed;
                    let maxThanMindi = this.getMaxCardThan(sessionId, card11);
                    if (maxThanMindi)
                        return maxThanMindi;
                    else
                        return this.getMinCardNotMindiOf(sessionId, firstSuitPlayed);
                }

                if (myMaxCard.number >= maxCard.number || myMaxCard.number > this.getMaxCardFromRemainingCards(firstSuitPlayed)) {
                    if (myMaxCard)
                        return myMaxCard;
                    else
                        return this.getMinCardNotMindiOf(sessionId, firstSuitPlayed);
                }

                return this.getMinCardNotMindiOf(sessionId, firstSuitPlayed);
            }
            else {
                if (maxCard.number === 0) {
                    let mindi: CCard = this.getMindiOf(sessionId, firstSuitPlayed);
                    if (mindi)
                        return mindi;
                    else
                        return this.getMinCardNotMindiOf(sessionId, firstSuitPlayed);
                }
                else {
                    if (maxCard.number < 9) {
                        let card11: CCard = new CCard();
                        card11.number = 10;
                        card11.suit = firstSuitPlayed;
                        let maxThanMindi: CCard = this.getMaxCardThan(sessionId, card11);
                        if (maxThanMindi != null)
                            return maxThanMindi;
                        else
                            return this.getMinCardNotMindiOf(sessionId, firstSuitPlayed);
                    }

                    if (maxCard.number > this.getMaxCardFromRemainingCards(firstSuitPlayed)) {
                        let mindi: CCard = this.getMindiOf(sessionId, firstSuitPlayed);
                        if (mindi)
                            return mindi;
                        else
                            return this.getMinCardNotMindiOf(sessionId, firstSuitPlayed);
                    }
                }

                return this.getMinCardNotMindiOf(sessionId, firstSuitPlayed);
            }
        }
        else if (!this.trumpActive) {
            
            this.trumpActive = true;

            if(!this.noSuitCards[sessionId]) {
                this.noSuitCards[sessionId] = firstSuitPlayed;
            }

            if (this.mode.toLowerCase() === `hide`) {
                return this.throwTrumpCard(sessionId, firstSuitPlayed);
            }
            else if (this.mode.toLowerCase() === `katte`) {
                return this.chooseTrumpCard(sessionId);
            }
            else {
                return this.getRandomCard(sessionId);
            }
        }
        else {
            if(!this.noSuitCards[sessionId]) {
                this.noSuitCards[sessionId] = firstSuitPlayed;
            }

            return this.getLowestCardNotMindi(sessionId);
        }
    }

    firstTurnAfterTrump(sessionId: string) : CCard {
        let suit: string = this.getPartnerCutSuit(sessionId);
        if (suit !== null) {
            return this.getMinCardNotMindiOf(sessionId, suit);
        }

        suit = this.getEnemyNotCutSuit(sessionId);
        if (suit !== null) {
            return this.getMinCardNotMindiOf(sessionId, suit);
        }
      
        let s: string = this.getMinCardSuitNotMindi(sessionId);
        let card: CCard = this.getMinCardNotMindiOf(sessionId, s);
        if (card != null)
            return card;

        if (this.hasThisSuitCard(sessionId, this.trump)) {
            return this.getMinCardNotMindiOf(sessionId, this.trump);
        }

        return this.getRandomCard(sessionId);
    }

    firstTurnBeforeTrump(sessionId: string) : CCard {
        if (this.roundsCompleted == 0) {
            let suit: string = this.getMinCardWithMindiSuit(sessionId);
            if (!this.lowSuitCards[sessionId])
                this.lowSuitCards[sessionId] = suit;

            return this.getMinCardNotMindiOf(sessionId, suit);
        }
        else {
            let suit: string = this.getPartersLowCardsSuit(sessionId);
            if (suit !== null && this.hasThisSuitCard(sessionId, suit)) {
                return this.getMinCardNotMindiOf(sessionId, suit);
            }
            
            suit = this.getMinCardSuitNotEnemyLowCards(sessionId);

            if (suit !== null && this.hasThisSuitCard(sessionId, suit)) {
                if (!this.lowSuitCards[sessionId])
                this.lowSuitCards[sessionId] = suit;

                return this.getMinCardNotMindiOf(sessionId, suit);
            }

            suit = this.getMinCardWithMindiSuit(sessionId);

            if (!this.lowSuitCards[sessionId])
                this.lowSuitCards[sessionId] = suit;

            return this.getMinCardNotMindiOf(sessionId, suit);
        }
    }

    lastTurnAfterHakam(sessionId: string, roundCards: ArraySchema<CCard>) : CCard {
        let followSuit: string = roundCards[0].suit;
        let maxCard: CCard = this.determinHighCard(roundCards);

        let mustFollowSuit: boolean = this.hasThisSuitCard(sessionId, followSuit);
        if (!mustFollowSuit) {
            if(!this.noSuitCards[sessionId]) {
                this.noSuitCards[sessionId] = followSuit;
            }
        }

        if (maxCard.suit == this.trump) {
            if (this.isMyPartner(sessionId, maxCard.playerSessionId)) {
                let mindi: CCard = this.getMindi(sessionId, followSuit, mustFollowSuit);
                if (mindi)
                    return mindi;
                else if (mustFollowSuit)
                    return this.getMinCardNotMindiOf(sessionId, followSuit);
                else {
                    let suit: string = this.getMinCardSuitNotMindi(sessionId);
                    return this.getMinCardNotMindiOf(sessionId, suit);
                }
            }

            if (maxCard.number < 9) {
                if (mustFollowSuit)
                    return this.getMinCardNotMindiOf(sessionId, followSuit);
                else {
                    let mindi: CCard = this.getMindiOf(sessionId, this.trump);
                    if (mindi)
                        return mindi;
                }
            }

            if (this.roundCardsContainMindi(roundCards)) {
                if (mustFollowSuit) {
                    if (this.hasJoker(sessionId))
                        return this.getRandomSuitCard(sessionId, this.jokerSuit);

                    return this.getMinCardNotMindiOf(sessionId, followSuit);
                }
                else {
                    let maxThanCard: CCard = this.getMaxCardThan(sessionId, maxCard);
                    if (maxThanCard)
                        return maxThanCard;

                    if (this.hasJoker(sessionId))
                        return this.getRandomSuitCard(sessionId, this.jokerSuit);
                }
            }

            if (mustFollowSuit)
                return this.getMinCardNotMindiOf(sessionId, followSuit);
            else {
                let suit: string = this.getMinCardSuitNotMindi(sessionId);
                return this.getMinCardNotMindiOf(sessionId, suit);
            }
        }
        else if (maxCard.number !== 0) {
            if (this.isMyPartner(sessionId, maxCard.playerSessionId)) {
                let mindi: CCard = this.getMindi(sessionId, followSuit, mustFollowSuit);
                if (mindi)
                    return mindi;
                else if (mustFollowSuit)
                    return this.getMinCardNotMindiOf(sessionId, followSuit);
                else {
                    let suit: string = this.getMinCardSuitNotMindi(sessionId);
                    return this.getMinCardNotMindiOf(sessionId, suit);
                }
            }

            if (maxCard.number < 9) {
                if (mustFollowSuit) {
                    let maxThanCard: CCard = this.getMaxCardThan(sessionId, maxCard);
                    if (maxThanCard)
                        return maxThanCard;

                    return this.getMinCardNotMindiOf(sessionId, followSuit);
                }
                else {
                    let mindi: CCard = this.getMindiOf(sessionId, this.trump);
                    if (mindi)
                        return mindi;

                    let trumpCard: CCard = this.getMinCardOf(sessionId, this.trump);
                    if (trumpCard)
                        return trumpCard;
                }
            }

            if (this.roundCardsContainMindi(roundCards)) {
                if (mustFollowSuit) {
                    let maxThanCard: CCard = this.getMaxCardThan(sessionId, maxCard);
                    if (maxThanCard)
                        return maxThanCard;

                    if (this.hasJoker(sessionId))
                        return this.getRandomSuitCard(sessionId, this.jokerSuit);

                    return this.getMinCardNotMindiOf(sessionId, followSuit);
                }
                else {
                    let mindi: CCard = this.getMindiOf(sessionId, this.trump);
                    if (mindi)
                        return mindi;

                    let trumpCard: CCard = this.getMinCardNotMindiOf(sessionId, this.trump);
                    if (trumpCard)
                        return trumpCard;
                }

                if (this.hasJoker(sessionId))
                    return this.getRandomSuitCard(sessionId, this.jokerSuit);
            }

            if (mustFollowSuit) {
                let maxThanCard: CCard = this.getMaxCardThan(sessionId, maxCard);
                if (maxThanCard)
                    return maxThanCard;

                return this.getMinCardNotMindiOf(sessionId, followSuit);
            }
            else {
                let trumpCard: CCard = this.getMinCardOf(sessionId, this.trump);
                if (trumpCard)
                    return trumpCard;
            }

            if (mustFollowSuit)
                return this.getMinCardNotMindiOf(sessionId, followSuit);
            else
                return this.getLowestCardNotMindi(sessionId);
        }
        else {
            if (this.isMyPartner(sessionId, maxCard.playerSessionId)) {
                let mindi: CCard = this.getMindi(sessionId, followSuit, mustFollowSuit);
                if (mindi)
                    return mindi;
                else if (mustFollowSuit)
                    return this.getMinCardOf(sessionId, followSuit);
            }

            if (this.hasJoker(sessionId))
                return this.getRandomSuitCard(sessionId, this.jokerSuit);

            if (mustFollowSuit)
                return this.getMinCardNotMindiOf(sessionId, followSuit);
            else {
                let suit: string = this.getMinCardSuitNotMindi(sessionId);
                return this.getMinCardNotMindiOf(sessionId, suit);
            }
        }
    }

    getMindi(sessionId: string, suit: string, mustFollowSuit: boolean) : CCard {
        return mustFollowSuit ? this.getMindiOf(sessionId, suit) : this.getAnyMindi(sessionId);
    }

    getAnyMindi(sessionId: string) : CCard {
        let handCards: MapSchema<CCard> = this.bots[sessionId].cards;
        for(let i = 0; i < this.suits.length; i++) {
            let s: string = this.suits[i];
            let cards: ArraySchema<CCard> = handCards[s];
            if(cards) {
                for(let i = 0; i < cards.length; i++) {
                    if(cards[i].number === 9)
                        return cards[i];
                }
            }
        }
        return null;
    }

    lastTurnBeforeHakam(sessionId: string, roundCards: ArraySchema<CCard>) : CCard {
        let firstSuitPlayed: string = roundCards[0].suit;
        let maxCard: CCard = this.determinHighCard(roundCards);

        if (this.hasThisSuitCard(sessionId, firstSuitPlayed)) {
            let myMaxCard: CCard = this.getMaxCardOf(sessionId, firstSuitPlayed);
            if (!this.isMyPartner(sessionId, maxCard.playerSessionId)) {
                if (maxCard.number === 0) {
                    if (this.hasJoker(sessionId))
                        return this.getRandomSuitCard(sessionId, this.jokerSuit);
                    else
                        return this.getMinCardNotMindiOf(sessionId, firstSuitPlayed);
                }

                if (this.roundCardsContainMindi(roundCards)) {
                    if (myMaxCard.number >= maxCard.number) {
                        let maxThanCard: CCard = this.getMaxCardThan(sessionId, maxCard);
                        if (maxThanCard)
                            return maxThanCard;
                        else
                            return maxCard;
                    }

                    if (this.hasJoker(sessionId))
                        return this.getRandomSuitCard(sessionId, this.jokerSuit);
                }

                if (maxCard.number < 9) {
                    let mindi: CCard = this.getMindiOf(sessionId, firstSuitPlayed);
                    if (mindi)
                        return mindi;

                    return this.getMinCardNotMindiOf(sessionId, firstSuitPlayed);
                }

                if (myMaxCard.number >= maxCard.number) {
                    let maxThanCard: CCard = this.getMaxCardThan(sessionId, maxCard);
                    if (maxThanCard)
                        return maxThanCard;
                    else
                        return maxCard;
                }

                return this.getMinCardNotMindiOf(sessionId, firstSuitPlayed);
            }
            else
            {
                let mindi: CCard = this.getMindiOf(sessionId, firstSuitPlayed);
                if (mindi)
                    return mindi;
                else
                    return this.getMinCardOf(sessionId, firstSuitPlayed);
            }
        }
        else if (!this.trumpActive)
        {
            this.trumpActive = true;

            if(!this.noSuitCards[sessionId]) {
                this.noSuitCards[sessionId] = firstSuitPlayed;
            }

            if (this.mode.toLowerCase() === `hide`)
            {
                return this.throwTrumpCard(sessionId, firstSuitPlayed);
            }
            else if (this.mode.toLowerCase() === `katte`)
            {
                return this.chooseTrumpCard(sessionId);
            }
            else
            {
                let suit: string = this.getMinCardSuitNotMindi(sessionId);
                return this.getMinCardNotMindiOf(sessionId, suit);
            }
        }
        else
        {
            if(!this.noSuitCards[sessionId]) {
                this.noSuitCards[sessionId] = firstSuitPlayed;
            }

            let suit: string = this.getMinCardSuitNotMindi(sessionId);
            return this.getMinCardNotMindiOf(sessionId, suit);
        }
    }

    chooseTrumpCard(sessionId: string) : CCard {
        let maxSuitCount: number = 0;
        let suit: string = this.suits[0];
        let handCards: MapSchema<CCard> = this.bots[sessionId].cards;

        for(let i = 0; i < this.suits.length; i++) {
            let s: string = this.suits[i];
            if (handCards[s] && handCards[s].length > maxSuitCount) {
                maxSuitCount = handCards[s].length;
                suit = s;
            }
        }

        this.trump = suit;
        if (this.enemyCut(suit, sessionId, sessionId) == null) {
            let mindi: CCard = this.getMindiOf(sessionId, suit);
            if (mindi) {
                mindi.isTrump = true;
                return mindi;
            }
            else {
                let trumpCard: CCard = handCards[suit][0];
                trumpCard.isTrump = true;
                return trumpCard;
            }
        }

        let trumpCard: CCard = handCards[suit][0];
        trumpCard.isTrump = true;
        return trumpCard;
    }

    throwTrumpCard(sessionId: string, firstSuitPlayed: string) : CCard {
        let handCards: MapSchema<CCard> = this.bots[sessionId].cards;
        if (this.hasThisSuitCard(sessionId, this.trump)) {
            if (this.enemyCut(firstSuitPlayed, sessionId, sessionId) == null) {
                let mindi: CCard = this.getMindiOf(sessionId, this.trump);
                if (mindi) {
                    mindi.isTrump = true;
                    return mindi;
                }
                else {
                    let trumpCard: CCard = handCards[this.trump][0];
                    trumpCard.isTrump = true;
                    return trumpCard;
                }
            }
            else {
                let trumpCard: CCard = handCards[this.trump][0];
                trumpCard.isTrump = true;
                return trumpCard;
            }
        }
        else {
            return this.getLowestCardNotMindi(sessionId);
        }
    }

    getLowestCardNotMindi(sessionId: string) : CCard {
        let card: CCard = null;
        let minRank: number = 13;
        let handCards: MapSchema<CCard> = this.bots[sessionId].cards;

        for(let i = 0; i < this.suits.length; i++) {
            let s: string = this.suits[i];
            if (s !== this.trump && handCards[s] && handCards[s].length > 0) {
                let minCard: CCard = this.getMinCardNotMindiOf(sessionId, s);
                if (minCard && minCard.number !== 9) {
                    if (minCard.number < minRank) {
                        minRank = minCard.number;
                        card = minCard;
                    }
                }
            }
        }
        if (card != null)
            return card;

        for(let i = 0; i < this.suits.length; i++) {
            let s: string = this.suits[i];
            if (s !== this.trump && handCards[s] && handCards[s].length > 0) {
                let minCard: CCard = this.getMinCardNotMindiOf(sessionId, s);
                if (minCard && minCard.number !== 9) {
                    card = minCard;
                }
            }
        }
        if (card != null)
            return card;

        for(let i = 0; i < this.suits.length; i++) {
            let s: string = this.suits[i];
            if (handCards[s] && handCards[s].length > 0) {
                let minCard: CCard = this.getMinCardNotMindiOf(sessionId, s);
                if (minCard && minCard.number !== 9) {
                    card = minCard;
                }
            }
        }

        if (!card) {
            let suit: string = this.getMinCardSuit(sessionId);
            card = this.getMinCardNotMindiOf(sessionId, suit);
        }

        return card;
    }

    getMaxCardFromRemainingCards(suit: string) : number {
        if(this.remainingCards[suit] && this.remainingCards[suit].length > 0) {
            let cards: ArraySchema<CCard> = this.remainingCards[suit];
            return cards && cards[cards.length - 1] && cards[cards.length - 1].number;
        }
        return 0;
    }

    getMinCardSuit(sessionId: string) : string {
        let suit: string = null;
        let min: number = 13;
        let handCards: MapSchema<CCard> = this.bots[sessionId].cards;

        for(let i = 0; i < this.suits.length; i++) {
            let s: string = this.suits[i];
            if (handCards[s] && handCards[s].length != 0 && handCards[s].length < min 
                && !this.isAllMindiIn(s, handCards) && s != this.trump) {
                min = handCards[s].length;
                suit = s;
            }
        }
        if (suit != null)
            return suit;

        min = 13;
        for(let i = 0; i < this.suits.length; i++) {
            let s: string = this.suits[i];
            if (handCards[s] && handCards[s].length != 0 && handCards[s].length < min 
                && s != this.trump) {
                min = handCards[s].length;
                suit = s;
            }
        }
        if (suit != null)
            return suit;

        min = 13;
        for(let i = 0; i < this.suits.length; i++) {
            let s: string = this.suits[i];
            if (handCards[s] && handCards[s].length != 0 && handCards[s].length < min) {
                min = handCards[s].length;
                suit = s;
            }
        }
        return suit;
    }

    getMindiOf(sessionId: string, suit: string) : CCard {
        let handCards: ArraySchema<CCard> = this.bots[sessionId].cards[suit];
        if(handCards) {
            for(let i = 0; i < handCards.length; i++) {
                if(handCards[i].number === 9)
                    return handCards[i];
            }
        }
        return null;
    }

    getMaxCardThan(sessionId: string, card: CCard) : CCard {
        let handCards: ArraySchema<CCard> = this.bots[sessionId].cards[card.suit];
        if(handCards) {
            for(let i = 0; i < handCards.length; i++) {
                if(handCards[i].number >= card.number)
                    return handCards[i];
            }
        }
        return null;
    }

    roundCardsContainMindi(roundCards: ArraySchema<CCard>) : boolean {
        if(roundCards) {
            for(let i = 0; i < roundCards.length; i++) {
                if(roundCards[i].number === 9) {
                    return true;
                }
            }
        }
        return false;
    }

    hasJoker(sessionId: string) : boolean {
        let handCards: MapSchema<CCard> = this.bots[sessionId].cards;
        return handCards[this.jokerSuit] && handCards[this.jokerSuit].length > 0;
    }

    isMyPartner(sessionId: string, partnerSessionId: string) : boolean {
        if(this.teamA.players[sessionId]) {
            if(this.teamA.players[partnerSessionId]) {
                return true;
            }
        }
        else {
            if(this.teamB.players[partnerSessionId]) {
                return true;
            }
        }
        return false;
    }

    getMinCardOf(sessionId: string, suit: string) : CCard {
        let handCards: ArraySchema<CCard> = this.bots[sessionId].cards[suit];
        let minCard: CCard = null;
        if(handCards) {
            minCard = handCards[0];
            for(let i = 1; i < handCards.length; i++) {
                if(handCards[i].number < minCard.number) {
                    minCard = handCards[i];
                }
            }
        }
        return minCard;
    }

    getMaxCardOf(sessionId: string, suit: string) : CCard {
        let handCards: ArraySchema<CCard> = this.bots[sessionId].cards[suit];
        let maxCard: CCard = null;
        if(handCards) {
            maxCard = handCards[0];
            for(let i = 1; i < handCards.length; i++) {
                if(handCards[i].number > maxCard.number) {
                    maxCard = handCards[i];
                }
            }
        }
        return maxCard;
    }

    getMinCardSuitNotEnemyLowCards(sessionId: string) : string {
        let suit: string = null;
        let min: number = 13;
        let handCards: MapSchema<CCard> = this.bots[sessionId].cards;

        for(let i = 0; i < this.suits.length; i++) {
            let s: string = this.suits[i];
            if (handCards[s] && handCards[s].length != 0 && handCards[s].length < min && !this.isEnemyLowCards(sessionId, s)) {
                min = handCards[s].length;
                suit = s;
            }
        }
        return suit;
    }

    isEnemyLowCards(sessionId: string, suit: string) : boolean {
        let enIds: string[] = this.getRemainingEnemyIds(sessionId);
        for(let i = 0; i < enIds.length; i++) {
            if(this.lowSuitCards[enIds[i]] === suit) {
                return true;
            }
        }
        return false;
    }

    getPartersLowCardsSuit(sessionId: string) : string {
        let cards: MapSchema<CCard> = this.bots[sessionId].cards;
        let s: string = null;
        for(let suit in cards) {
            let prIds: string[] = this.getRemainingPartnerIds(sessionId);
            for(let i = 0; i < prIds.length; i++) {
                if(this.lowSuitCards[prIds[i]] === suit) {
                    s = suit;
                }
            }
        }
        return s;
    }

    getMinCardWithMindiSuit(sessionId: string) : string {
        let suit: string = null;
        let min: number = 13;
        let handCards: MapSchema<CCard> = this.bots[sessionId].cards;

        for(let i = 0; i < this.suits.length; i++) {
            let s: string = this.suits[i];
            if (handCards[s] && handCards[s].length != 0 && handCards[s].length < min) {
                min = handCards[s].length;
                suit = s;
            }
        }
        return suit;
    }

    getMinCardSuitNotMindi(sessionId: string) : string {
        let suit: string = null;
        let min: number = 13;
        let handCards: MapSchema<CCard> = this.bots[sessionId].cards;

        //check if we have min card suit that is not trump & has notMindi Card
        for(let i = 0; i < this.suits.length; i++) {
            let s: string = this.suits[i];
            if (handCards[s] && handCards[s].length != 0 && handCards[s].length < min 
                && !this.isAllMindiIn(s, handCards) && s !== this.trump) {
                min = handCards[s].length;
                suit = s;
            }
        }
        if (suit !== null)
            return suit;


        //check if we have trump that has notMindi card
        for(let i = 0; i < this.suits.length; i++) {
            let s: string = this.suits[i];
            if (handCards[s] && handCards[s].length != 0 && handCards[s].length < min 
                && !this.isAllMindiIn(s, handCards)) {
                min = handCards[s].length;
                suit = s;
            }
        }
        if (suit !== null)
            return suit;

        //check if we have all mindi cards
        for(let i = 0; i < this.suits.length; i++) {
            let s: string = this.suits[i];
            if (handCards[s] && handCards[s].length != 0 && handCards[s].length < min) {
                min = handCards[s].length;
                suit = s;
            }
        }

        if (suit !== null)
            return suit;

        return suit;
    }

    isAllMindiIn(suit: string, handCards: MapSchema<CCard>) : boolean {
        let cards: ArraySchema<CCard> = handCards[suit];
        if(cards) {
            for(let i = 0; i < cards.length; i++) {
                if(cards[i].number !== 9) {
                    return false;
                }
            }
        }
        return true;
    }

    getMinCardNotMindiOf(sessionId: string, suit: string) : CCard {
        let player: CPlayer = this.bots[sessionId];
        let cards: ArraySchema<CCard> = player.cards[suit];

        if(cards) {
            for(let i = 0; i < cards.length; i++) {
                if(cards[i].number !== 9)
                    return cards[i];
            }
        }
        return null;
    }

    getEnemyNotCutSuit(sessionId: string) : string {
        for(let i = 0; i < this.suits.length; i++) {
            if(this.suits[i] !== this.trump && this.hasThisSuitCard(sessionId, this.suits[i])) {
                if(this.enemyCut(this.suits[i], sessionId, sessionId) == null) {
                    return this.suits[i];
                }
            }
        }
        return null;
    }

    getPartnerCutSuit(sessionId: string) : string {

        if (this.playerCount == 4)
            return this.getPartnerCutSuit4Player(sessionId);
        else if (this.playerCount == 6)
            return this.getPartnerCutSuit6Player(sessionId);

        return null;
    }

    getPartnerCutSuit4Player(sessionId: string) : string {
        let suit: string = null;
        let prIds: string[] = this.getRemainingPartnerIds(sessionId);
        let enIds: string[] = this.getRemainingEnemyIds(sessionId);

        for(let i = 0; i < this.suits.length; i++) {
            if(this.suits[i] !== this.trump && this.hasThisSuitCard(sessionId, this.suits[i])) {
                if(this.isCut(this.suits[i], prIds[0]) && !this.isCut(this.suits[i], enIds[1])) {
                    suit = this.suits[i];
                }
            }
        }
        return suit;
    }

    getPartnerCutSuit6Player(sessionId: string) : string {
        let suit: string = null;
        var prIds = this.getRemainingPartnerIds(sessionId);
        var enIds = this.getRemainingEnemyIds(sessionId);

        // check for first partner
        for(let i = 0; i < this.suits.length; i++) {
            if(this.suits[i] !== this.trump && this.hasThisSuitCard(sessionId, this.suits[i])) {
                if (this.isCut(this.suits[i], prIds[0])) {
                    if (this.enemyCut(this.suits[i], prIds[0], sessionId) == null) {
                        suit = this.suits[i];
                    }
                    else {
                        if (this.isCut(this.suits[i], enIds[1])) {
                            if (this.isCut(this.suits[i], prIds[1]) && this.isCut(this.suits[i], enIds[2])) {
                                suit = this.suits[i];
                            }
                        }
                    }
                }
            }
        }

        if (suit !== null)
            return suit;

        //check for second partner
        for(let i = 0; i < this.suits.length; i++) {
            if(this.suits[i] !== this.trump && this.hasThisSuitCard(sessionId, this.suits[i])) {
                if(this.isCut(this.suits[i], prIds[1]) && !this.isCut(this.suits[i], enIds[2])) {
                    suit = this.suits[i];
                }
            }
        }

        return suit;
    }

    getRemainingPartnerIds(sessionId: string) : string[] {
        let prIds: string[] = [];
        if(this.teamA.players[sessionId]) {
            for(let id in this.teamA.players) {
                if(this.curRoundPlayedPlayers.indexOf(id) == -1 && sessionId !== id) {
                    prIds.push(id);
                }
            }
        }
        else {
            for(let id in this.teamB.players) {
                if(this.curRoundPlayedPlayers.indexOf(id) == -1 && sessionId !== id) {
                    prIds.push(id);
                }
            }
        }
        return prIds;
    }

    getRemainingEnemyIds(sessionId: string) : string[] {
        let enIds: string[] = [];
        if(this.teamA.players[sessionId]) {
            for(let id in this.teamB.players) {
                if(this.curRoundPlayedPlayers.indexOf(id) == -1) {
                    enIds.push(id);
                }
            }
        }
        else {
            for(let id in this.teamA.players) {
                if(this.curRoundPlayedPlayers.indexOf(id) == -1) {
                    enIds.push(id);
                }
            }
        }
        return enIds;
    }

    hasThisSuitCard(sessionId: string, suit: string) : boolean {
        let player: CPlayer = this.bots[sessionId];
        return player.cards[suit] && player.cards[suit].length > 0;
    }

    isCut(suit: string, sessionId: string) : boolean {
        let noSuits: string[] = this.noSuitCards[sessionId];
        if(!noSuits) {
            noSuits = [];
        }
        return noSuits.indexOf(suit) !== -1 && noSuits.indexOf(this.trump) === -1;
    }

    enemyCut(suit: string, sessionId: string, curSessionId: string) : string {
        let enIds: string[] = this.getRemainingEnemyIds(sessionId);

        for(let i = 0; i < enIds.length; i++) {
            if(enIds[i] !== curSessionId) {
                if(this.isCut(suit, enIds[i])) {
                    return enIds[i];
                }
            }
        }
        return null;
    }

    partnerCut(suit: string, sessionId: string, curSessionId: string) : string {
        let prIds: string[] = this.getRemainingPartnerIds(sessionId);

        for(let i = 0; i < prIds.length; i++) {
            if(prIds[i] !== curSessionId) {
                if(this.isCut(suit, prIds[i])) {
                    return prIds[i];
                }
            }
        }
        return null;
    }
}