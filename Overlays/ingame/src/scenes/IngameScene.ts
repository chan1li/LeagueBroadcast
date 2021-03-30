import 'phaser';
import variables from '~/variables';
import WebFontLoaderPlugin from 'phaser3-rex-plugins/plugins/webfontloader-plugin.js';
import ObjectiveIndicator from '~/data/objectiveIndicator';
import StateData from '~/data/stateData';
import PlaceholderConversion from '~/PlaceholderConversion';
import ItemIndicator from '~/data/itemIndicator';
import GraphPopUp from '~/data/graphPopUp';
import Phaser from 'phaser';
import GoldEntry from '~/data/goldEntry';

export default class IngameScene extends Phaser.Scene
{
    ws!: WebSocket;
    players: Phaser.Display.Masks.BitmapMask[];
    baronIndicator!: ObjectiveIndicator;
    elderIndicator!: ObjectiveIndicator;
    goldGraph!: GraphPopUp;

    state!: StateData | null;

    graphics!: Phaser.GameObjects.Graphics;
    

    constructor ()
    {
        super('ingameOverlay');
        this.players = [];
    }

    preload ()
    {
        var config = {
            google: {
                families: ['Droid Sans', 'News Cycle', 'News Cycle:bold']
            }
        };

        //@ts-ignore
        this.graphics = this.add.graphics();

        // @ts-ignore
        this.load.rexWebFont(config);
        this.load.script('chartjs', 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/2.9.3/Chart.min.js');
        //this.load.script('chartjs', 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/3.0.0-rc/chart.min.js');

        this.load.image('champCoverLeft', 'frontend/images/ChampCoverLeft.png');
        this.load.image('champCoverRight', 'frontend/images/ChampCoverRight.png');

        this.load.image('baronIcon', 'frontend/backgrounds/BaronIcon.png');
        this.load.image('objectiveBg', 'frontend/backgrounds/ObjectiveBG.png');
        this.load.image('objectiveMask', 'frontend/backgrounds/ObjectiveMask.png');

        this.load.image('dragonIcon', 'frontend/backgrounds/DragonIcon.png');
        this.load.image('objectiveBgLeft', 'frontend/backgrounds/ObjectiveBGLeft.png');

        this.load.image('goldIcon', 'frontend/images/goldicon.png');
        this.load.image('cdr', 'frontend/images/cdr.png');

        this.load.image('centerCover', 'frontend/backgrounds/CenterCover.png');
    }

    create ()
    {
        var div = document.getElementById('gameContainer');

        const blue_1 = this.make.sprite({x: 39 , y: 152 + 37, key: 'champCoverLeft', add: false}).createBitmapMask();
        const blue_2 = this.make.sprite({x: 39 , y: 255 + 37, key: 'champCoverLeft', add: false}).createBitmapMask();
        const blue_3 = this.make.sprite({x: 39 , y: 358 + 37, key: 'champCoverLeft', add: false}).createBitmapMask();
        const blue_4 = this.make.sprite({x: 39 , y: 461 + 37, key: 'champCoverLeft', add: false}).createBitmapMask();
        const blue_5 = this.make.sprite({x: 39 , y: 564 + 37, key: 'champCoverLeft', add: false}).createBitmapMask();

        const red_1 = this.make.sprite({x: 1920 - 39, y: 152 + 37, key:'champCoverRight', add: false}).createBitmapMask();
        const red_2 = this.make.sprite({x: 1920 - 39, y: 255 + 37, key:'champCoverRight', add: false}).createBitmapMask();
        const red_3 = this.make.sprite({x: 1920 - 39, y: 358 + 37, key:'champCoverRight', add: false}).createBitmapMask();
        const red_4 = this.make.sprite({x: 1920 - 39, y: 461 + 37, key:'champCoverRight', add: false}).createBitmapMask();
        const red_5 = this.make.sprite({x: 1920 - 39, y: 564 + 37, key:'champCoverRight', add: false}).createBitmapMask();

        this.players = [blue_1, blue_2, blue_3, blue_4, blue_5, red_1, red_2, red_3, red_4, red_5];

        this.baronIndicator = new ObjectiveIndicator('baron', 1800, 55, this, 'baronIcon', 'objectiveBg', '00:00', 0, true );
        this.elderIndicator = new ObjectiveIndicator('elder', 120, 55, this, 'dragonIcon', 'objectiveBgLeft', '00:00', 0, false);
        //Color calc breaks with no data so init with dummy data
        this.goldGraph = new GraphPopUp(this, [new GoldEntry(0,100), new GoldEntry(1,-100)]);

        const connect = () => {
            this.ws = new WebSocket(`${variables.useSSL? 'wss' : 'ws'}://${variables.backendUrl}:${variables.backendPort}/${variables.backendWsLoc}`);
            this.ws.onopen = () => {
                console.log('[LBH] Connection established!')
            };
    
            this.ws.onclose = () => {
                setTimeout(connect, 500);
                console.log('[LBH] Attempt reconnect in 500ms');
            };
            this.ws.onerror = () => {
                console.log('[LBH] Connection error!');
            };
    
            this.ws.onmessage = msg => {
                const data = JSON.parse(msg.data);
                // Maybe check if heartbeat arrives regularly to assure that connection is alive?

                if (data.eventType) {
                    switch (data.eventType) {
                        case 'GameHeartbeat':
                            OnNewState(data.stateData);
                            break;
                        case 'PlayerLevelUp':
                            doLevelUp(data.playerId, data.level);
                            console.log('Level Up Event with ID: ' + data.playerId + ', lvl: ' + data.level);
                            break;
                        case 'ObjectiveKilled':
                            console.log('Legacy objective kill: ' + JSON.stringify(data));
                            showObjective(data.objective);
                            break;
                        case 'BuffDespawn':
                            console.log('Legacy objective despawn: ' + JSON.stringify(data)); 
                            hideObjective(data.objective);
                            break;
                        case 'ItemCompleted':
                            new ItemIndicator(data.itemData, data.playerId, this);
                            break;
                        case 'GameEnd':
                            console.log('Game Ended');
                            this.state = null;
                            this.baronIndicator.hideContent();
                            this.elderIndicator.hideContent();
                            this.goldGraph.Disable();
                            break;
                        case 'GameStart':
                            console.log('Game Start');
                            break;
                        case 'GamePause':
                            break;
                        case 'GameUnpause':
                            break;
                        case 'newState':
                        case 'newAction':
                        case 'heartbeat':
                        case 'champSelectStart':
                        case 'champSelectEnd':
                            //pick/ban event, ignore
                            break;
                        default:
                            console.log('[LBH] Unknown event type: ' + JSON.stringify(data));
                            break;
                    }
                } else {
                    console.log('[LBH] Unexpected packet format: ' + JSON.stringify(data));
                }
            };
        };

        const showObjective = (objective: string) => {
            console.log(`${objective} taken`);
            switch (objective) {
                case 'baron':
                    this.baronIndicator.updateContent(this.state?.baron!);
                    this.baronIndicator.showContent();
                    break;
                case 'elder':
                    this.elderIndicator.updateContent(this.state?.dragon!);
                    this.elderIndicator.showContent();
                    break;
                default:
                    break;
            }
        };

        const hideObjective = (objective: string) => {
            switch (objective) {
                case 'baron':
                    this.baronIndicator.hideContent();
                    break;
                case 'elder':
                    this.elderIndicator.hideContent();
                    break;
                default:
                    break;
            }
        }

        const doLevelUp = (playerId: number, level: number) => {
            var team = playerId > 4;
            var x = team ? 1881: 39;
            var y = team ? 289 + ((playerId - 5) * 103) : 289 + (playerId * 103);
            console.log(x + ', ' + y);
            var finalY = y - 100;
            //var colorRect = this.add.image(x, y, team ? 'red' : 'blue');
            var colorRect = this.add.rectangle(x,y,100,100, team? variables.redColor : variables.blueColor);

            var textX;
            switch (level) {
                case 6:
                    textX = x - 15;
                    break;
                case 11:
                    textX = x - 23;
                    break;
                case 16:
                    textX = x - 30;
                    break;
            }
            var levelText = this.add.text(textX, y-33, ''+level, {
                fontFamily: 'News Cycle',
                fontSize: '60px',
                fontStyle: 'Bold'
              });

            colorRect.setMask(this.players[playerId]);
            levelText.setMask(this.players[playerId]);

            //Background Animation
            this.tweens.add({
                targets: colorRect,
                props: {
                    y: { value: '-= 100', duration: variables.levelAnimationMoveTime, ease: 'Quad.easeOut' }
                },
                paused: false,
                yoyo: false
            });

            var dir = team? '-= 90' : '+= 90';
            this.tweens.add({
                targets: colorRect,
                props: {
                    x: { value: dir, duration: variables.levelAnimationMoveTime, ease: 'Quad.easeIn' }
                },
                paused: false,
                yoyo: false,
                delay: 4000,
                onComplete: function() {colorRect.destroy();}
            });

            //Level Text Animation
            this.tweens.add({
                targets: levelText,
                props: {
                    y: { value: '-= 100', duration: variables.levelAnimationMoveTime, ease: 'Quad.easeOut' }
                },
                paused: false,
                yoyo: false,
                delay: 250
            });

            this.tweens.add({
                targets: levelText,
                props: {
                    y: { value: '-= 100', duration: variables.levelAnimationMoveTime, ease: 'Quad.easeOut' }
                },
                paused: false,
                yoyo: false,
                delay: 3750,
                onComplete: function() {levelText.destroy();}
            });

        };

        const OnNewState = (data: any): void => {
            var newState = new StateData(data);

            //console.log(newState)
            this.baronIndicator.updateContent(newState.baron);

            this.elderIndicator.updateContent(newState.dragon);
            this.goldGraph.Update(newState.goldGraph);

            this.state = newState;
        }

        connect();

        //Objective Timer debugging
        /*
        this.state = new StateData({
            "dragon":{
               "Objective":{
                  "Type":"cloud",
                  "Cooldown":117,
                  "IsAlive":false,
                  "TimesTakenInMatch":3,
                  "LastTakenBy":0
               },
               "DurationRemaining":"00:00",
               "GoldDifference":0
            },
            "baron":{
               "Objective":{
                  "Type":"Baron",
                  "Cooldown":354,
                  "IsAlive":false,
                  "TimesTakenInMatch":11,
                  "LastTakenBy":0
               },
               "DurationRemaining":"01:58",
               "GoldDifference":2300
            },
            "blueDragons":[
               
            ],
            "redDragons":[
               
            ],
            "gameTime":1174.7066650390625,
            "gamePaused":false,
            "blueGold":45400,
            "redGold":35900
         });
         var s = this.state!;
        s.baron.DurationRemaining = '02:00';
        s.baron.GoldDifference = 0;
        s.dragon.DurationRemaining = '1:35';
        s.dragon.GoldDifference = 1500;
        showObjective('baron');
        showObjective('elder');
        */
    }
}