import * as Phaser from "phaser"
import { UserSettings, UserSettingsKey } from "./UserSettingsScene"
import { getSeedsFromAPI, emptySeedData } from "../firebase"
import { BattleScene } from "../battle/Scene"
import * as c from "../constants"
import { GameMode } from "../battle/utils/gameMode"
import { SeedsResponse } from "../../functions/src/api-contracts"
import { TrialLobby } from "./TrialLobby"
import { RoyaleLobby } from "./RoyaleLobby"
import { getAndBumpUserCycleSeedIndex, getUserSettings, getUserStatistics } from "../user/userManager"
import { preloadBackgroundBlobImages, setupBackgroundBlobImages } from "./utils/backgroundColors"
import { preloadBirdSprites, BirdSprite } from "../battle/BirdSprite"
import { becomeButton } from "./utils/becomeButton"
import { defer } from "lodash"

/** Used on launch, and when you go back to the main menu */
export const launchMainMenu = (game: Phaser.Game) => {
    const mainMenu = new MainMenuScene()
    game.scene.add("MainMenu", mainMenu, true)
}

export class MainMenuScene extends Phaser.Scene {
    seeds: SeedsResponse
    battleBG: BattleScene

    constructor() {
        super("MainMenu")
    }

    preload() {
        this.load.image("logo", require("../../assets/menu/logo.png"))
        this.load.image("royale-button", require("../../assets/menu/royale-2.png"))
        this.load.image("trial-button", require("../../assets/menu/trial-2.png"))
        this.load.image("settings-button", require("../../assets/menu/settings-2.png"))
        preloadBackgroundBlobImages(this)
        preloadBirdSprites(this)

        this.load.bitmapFont(
            "nokia16",
            require("../../assets/fonts/nokia16.png"),
            require("../../assets/fonts/nokia16.xml")
        )
    }

    create() {
        // To make sure we clean up after ourselves
        const existingScenes = this.game.scene.scenes
        if (existingScenes.length > 1) {
            console.error("Too many scenes when creating a menu, you might be leaking scenes!")
            console.error("Scenes:", existingScenes)
        }

        this.battleBG = new BattleScene({ key: "menu-bg", seed: "menu", data: emptySeedData, gameMode: GameMode.Menu })
        this.game.scene.add("battlebg", this.battleBG, true)
        this.game.scene.bringToTop("MainMenu")

        // Fill the BG
        this.add.rectangle(c.GameWidth / 2, c.GameHeight / 2, c.GameWidth, c.GameHeight, 0x000000, 0.4)

        const logo = this.add.image(84, 50 + c.NotchOffset, "logo")
        becomeButton(logo, this.loadRoyale, this)

        setupBackgroundBlobImages(this, { min: 100 + c.NotchOffset, allColors: true })

        const stats = getUserStatistics()

        const wins = this.add.bitmapText(c.GameWidth, c.NotchOffset, "nokia16", "wins: " + stats.royaleWins, 0)

        const rightAligned = c.GameWidth - wins.getTextBounds(true).local.width
        wins.setX(rightAligned - 1)

        // NOTE: ASYNC!
        getSeedsFromAPI(c.APIVersion).then(seeds => {
            this.seeds = seeds
        })

        const settings = getUserSettings()
        const player = new BirdSprite(this, 6, c.GameHeight - 12, { isPlayer: false, settings: settings })
        player.actAsImage()
        player.makeClickable(this.loadSettings, this)
        this.add.bitmapText(26, c.GameHeight - 20, "nokia16", settings.name, 0)

        const royaleButton = this.add.image(84, 110 + c.NotchOffset, "royale-button")
        becomeButton(royaleButton, this.loadRoyale, this)

        const trial = this.add.image(74, 146 + c.NotchOffset, "trial-button")
        becomeButton(trial, this.loadTrial, this)

        const settingsButton = this.add.image(76, 200 + c.NotchOffset, "settings-button")
        becomeButton(settingsButton, this.loadSettings, this)
    }

    private loadSettings() {
        this.removeMenu()
        const settings = new UserSettings()
        this.game.scene.add(UserSettingsKey, settings, true)
    }

    private loadTrial() {
        this.removeMenu()
        const seed = this.seeds.daily.production
        const lobby = new TrialLobby({ seed })
        this.game.scene.add("TrialLobby" + seed, lobby, true, {})
    }

    private loadRoyale() {
        this.removeMenu()
        const index = getAndBumpUserCycleSeedIndex(this.seeds.royale.length)
        const seed = this.seeds.royale[index]
        const lobby = new RoyaleLobby({ seed })
        this.game.scene.add("RoyaleLobby" + seed, lobby, true, {})
    }

    private removeMenu() {
        // We get a JS error if we just remove the scene before the new scene has started (finished?) loading
        // Phaser's docs claim scene.remove() will process the operation, but that seems to not be the case
        // Manually pushing the remove action til the next update loop seems to fix it /shrug
        defer(() => {
            this.game.scene.remove(this)
            this.game.scene.remove(this.battleBG)
        })
    }
}
