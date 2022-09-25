import { SingleTouchListener, isTouchSupported, KeyboardHandler } from './io.js';
import { getHeight, getWidth, RGB } from './gui.js';
import { random } from './utils.js';
import { SpatialHashMap2D, SquareAABBCollidable } from './game_utils.js';
class Ball extends SquareAABBCollidable {
    constructor(x, y, radius) {
        super(x - radius, y - radius, radius * 2, radius * 2);
        this.radius = radius;
        this.direction = [-400, 400];
        this.attack_power = 1;
    }
    mid_x() {
        return this.x + this.width / 2;
    }
    mid_y() {
        return this.y + this.height / 2;
    }
    draw(canvas, ctx, x = this.x, y = this.y, width = this.width, height = this.height) {
        ctx.beginPath();
        ctx.lineWidth = 5;
        ctx.strokeStyle = "#00FF00";
        ctx.fillStyle = "#FF0000";
        ctx.moveTo(x + this.radius * 2, y + this.radius);
        ctx.arc(x + this.radius, y + this.radius, this.radius, 0, 2 * Math.PI);
        ctx.stroke();
        ctx.fill();
        ctx.beginPath();
    }
    update_state(delta_time) {
        this.x += this.direction[0] * delta_time / 1000;
        this.y += this.direction[1] * delta_time / 1000;
    }
    bounce(x, y, width, height) {
        if (this.x + this.width >= x + width) {
            if (this.direction[0] > 0)
                this.direction[0] *= -1;
            return true;
        }
        else if (this.x <= 0) {
            if (this.direction[0] < 0)
                this.direction[0] *= -1;
            return true;
        }
        if (this.y + this.height >= y + height) {
            if (this.direction[1] > 0)
                this.direction[1] *= -1;
            return true;
        }
        else if (this.y <= 0) {
            if (this.direction[1] < 0)
                this.direction[1] *= -1;
            return true;
        }
        return false;
    }
    hit(brick) {
        brick.take_damage(this.attack_power);
    }
}
;
class Brick extends SquareAABBCollidable {
    constructor(x, y, width, height) {
        super(x, y, width, height);
        this.type_id = random() * 15;
        this.hp = 1;
    }
    take_damage(damage) {
        this.hp -= damage;
    }
    draw(canvas, ctx, x = this.x, y = this.y, width = this.width, height = this.height) {
        ctx.strokeStyle = "#000000";
        ctx.fillStyle = new RGB(125 + 60 * this.type_id % 256, 92 * this.type_id % 256, 125 * this.type_id % 256).htmlRBG();
        ctx.strokeRect(x, y, width, height);
        ctx.fillRect(x, y, width, height);
    }
    update_state(delta_time) {
        throw new Error('Method not implemented.');
    }
}
;
class Game extends SquareAABBCollidable {
    constructor(touchListener, x, y, width, height) {
        super(x, y, width, height);
        this.bricks = [];
        this.paddle_vel_x = 0;
        this.balls = [new Ball(width * 0.9, height * 0.9, width * 0.02)];
        this.paddle = new Brick(width / 2 - width * 0.05, height * 0.95, width * 0.1, height * 0.05);
        this.bricks.push(this.paddle);
        this.init(width, height);
    }
    init(width, height) {
        const bricks_across = 20;
        const brick_width = width / bricks_across;
        const brick_height = height * 0.05;
        for (let y = 0; y < 5 * brick_height; y += brick_height) {
            for (let x = 0; x < 20 * brick_width; x += brick_width) {
                this.bricks.push(new Brick(x, y, brick_width, brick_height));
            }
        }
    }
    resize(width, height) {
        const bricks_across = 20;
        const brick_width = Math.floor(width / bricks_across);
        const brick_height = Math.floor(height * 0.05);
        for (let i = 0; i < this.bricks.length; i++) {
            const brick = this.bricks[i++];
            const px = brick.x / this.width;
            const py = brick.y / this.height;
            brick.x = px * width;
            brick.y = py * height;
            brick.width = brick_width;
            brick.height = brick_height;
        }
        this.paddle.width *= 3;
        this.width = width;
        this.height = height;
    }
    draw(canvas, ctx, x, y, width, height) {
        ctx.clearRect(x, y, width, height);
        for (let i = 0; i < this.bricks.length; i++) {
            const brick = this.bricks[i];
            brick.draw(canvas, ctx, brick.x, brick.y, brick.width, brick.height);
        }
        for (let i = 0; i < this.balls.length; i++) {
            const ball = this.balls[i];
            ball.draw(canvas, ctx);
        }
        this.paddle.draw(canvas, ctx);
    }
    update_state(delta_time) {
        this.collision_map = new SpatialHashMap2D(this.balls, this.bricks, this.width, this.height, 20, 20);
        this.collision_map.handle_by_cell((a, b) => { }, (ball, brick) => {
            if (ball.radius && brick.collides_with_circle(ball)) {
                const b = ball;
                if (brick === this.paddle) {
                    if (b.direction[1] > 0) {
                        b.direction[1] *= -1;
                        b.y = brick.y - b.height;
                    }
                }
                else {
                    b.hit(brick);
                    const bri = brick;
                    if ((ball.mid_x() + b.radius - brick.x) < 10) {
                        if (b.direction[0] > 0)
                            b.direction[0] *= -1;
                    }
                    else if ((ball.mid_x() - brick.x - brick.width) > -10) {
                        if (b.direction[0] < 0)
                            b.direction[0] *= -1;
                    }
                    if (ball.mid_y() + b.radius - brick.y < 10) {
                        if (b.direction[1] > 0)
                            b.direction[1] *= -1;
                    }
                    else if (ball.mid_y() - brick.y - brick.height > -10) {
                        if (b.direction[1] < 0)
                            b.direction[1] *= -1;
                    }
                    if (bri.hp <= 0) {
                        const tdb_index = this.bricks.indexOf(bri);
                        if (tdb_index >= 0)
                            this.bricks.splice(tdb_index, 1);
                    }
                }
            }
        });
        for (let i = 0; i < this.balls.length; i++) {
            this.balls[i].update_state(delta_time);
            this.balls[i].bounce(this.x, this.y, this.width, this.height);
        }
        this.paddle.x += this.paddle_vel_x;
        if (this.paddle.x > this.width) {
            this.paddle.x = -this.paddle.width;
        }
        if (this.paddle.x + this.paddle.width < 0) {
            this.paddle.x = this.width;
        }
    }
}
;
async function main() {
    const canvas = document.getElementById("screen");
    const touchListener = new SingleTouchListener(canvas, false, true, false);
    const keyboardHandler = new KeyboardHandler();
    canvas.onmousemove = (event) => {
    };
    canvas.addEventListener("wheel", (e) => {
        //e.preventDefault();
    });
    canvas.width = getWidth();
    canvas.height = getHeight();
    canvas.style.cursor = "pointer";
    let counter = 0;
    const touchScreen = isTouchSupported();
    let height = getHeight();
    let width = getWidth();
    let game = new Game(touchListener, 0, 0, height, width);
    keyboardHandler.registerCallBack("keydown", () => true, (event) => {
        switch (event.code) {
            case ("Space"):
                game.balls.push(new Ball(game.paddle.mid_x(), game.paddle.y - 20, 10));
                game.balls.forEach(ball => ball.release());
                break;
            case ("ArrowLeft"):
                game.paddle_vel_x = -10;
                break;
            case ("ArrowRight"):
                game.paddle_vel_x = 10;
                break;
            case ("ArrowUp"):
                break;
            case ("ArrowDown"):
                break;
        }
    });
    keyboardHandler.registerCallBack("keyup", () => true, (event) => {
        game.paddle_vel_x = 0;
        switch (event.code) {
            case ("ArrowLeft"):
                game.paddle_vel_x = 0;
                break;
            case ("ArrowRight"):
                game.paddle_vel_x = 0;
                break;
        }
    });
    let maybectx = canvas.getContext("2d");
    if (!maybectx)
        return;
    const ctx = maybectx;
    let start = Date.now();
    let dt = 1;
    const drawLoop = () => {
        //do stuff and render here
        if (getWidth() !== canvas.width || getHeight() !== canvas.height) {
            game.resize(getWidth(), getHeight());
            canvas.width = game.width;
            canvas.height = game.height - 25;
            game.resize(canvas.width, canvas.height);
            //console.log(game.width, game.height);
        }
        dt = Date.now() - start;
        start = Date.now();
        game.update_state(dt);
        game.draw(canvas, ctx, game.x, game.y, game.width, game.height);
        requestAnimationFrame(drawLoop);
    };
    drawLoop();
}
main();
