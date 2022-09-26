import { SingleTouchListener, isTouchSupported, KeyboardHandler } from './io.js';
import { getHeight, getWidth, RGB } from './gui.js';
import { random, srand } from './utils.js';
import { SpatialHashMap2D, SquareAABBCollidable } from './game_utils.js';
class Ball extends SquareAABBCollidable {
    constructor(x, y, radius) {
        super(x - radius, y - radius, radius * 2, radius * 2);
        this.radius = radius;
        this.direction = [0, 0];
        this.attack_power = 1;
    }
    released() {
        return this.direction[0] !== 0;
    }
    release() {
        if (!this.released()) {
            srand(Math.random());
            this.direction = [(random() - 0.5) * getWidth() / 3, -random() * getHeight() / 2 - 100];
        }
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
            return false;
        }
        else if (this.x <= 0) {
            if (this.direction[0] < 0)
                this.direction[0] *= -1;
            return false;
        }
        else if (this.y + this.height >= y + height) {
            if (this.direction[1] > 0)
                this.direction[1] *= -1;
            return true;
        }
        else if (this.y <= 0) {
            if (this.direction[1] < 0)
                this.direction[1] *= -1;
            return false;
        }
        return false;
    }
    hit(brick) {
        brick.take_damage(this.attack_power);
        this.direction[1] *= 1.01;
    }
}
;
class Brick extends SquareAABBCollidable {
    constructor(x, y, width, height) {
        super(x, y, width, height);
        this.type_id = Math.floor(random() * 15) + 1;
        this.hp = Math.floor(this.type_id / 4) + 1;
    }
    take_damage(damage) {
        this.hp -= damage;
    }
    draw(canvas, ctx, x = this.x, y = this.y, width = this.width, height = this.height) {
        ctx.strokeStyle = "#000000";
        ctx.fillStyle = new RGB(125 + 60 * this.type_id % 256, 92 * this.type_id % 256, 125 * this.type_id % 256).htmlRBG();
        ctx.strokeRect(x, y, width, height);
        ctx.fillRect(x, y, width, height);
        ctx.fillStyle = "#000000";
        ctx.fillText(this.hp, this.mid_x(), this.mid_y());
    }
    update_state(delta_time) {
        if (this.hp <= 0) {
            srand(this.type_id);
            this.y += (random() * 200 + 200) * delta_time / 1000;
        }
    }
}
;
function calc_x_vel_paddle() {
    return Math.max(getWidth(), getHeight()) / (isTouchSupported() ? 1 : 2);
}
const keyboardHandler = new KeyboardHandler();
class Game extends SquareAABBCollidable {
    constructor(touchListener, x, y, width, height) {
        super(x, y, width, height);
        this.paddle_accel_x = 0;
        this.paddle_target_vel_x = calc_x_vel_paddle();
        this.last_dx = 0;
        this.bricks = [];
        this.paddle_vel_x = 0;
        this.paddle = new Brick(width / 2 - width * 0.05, height * 0.95, width * 0.1, height * 0.05);
        this.balls = [];
        this.add_ball();
        this.bricks.push(this.paddle);
        this.init(width, height);
        touchListener.registerCallBack("touchmove", () => true, (event) => {
            this.last_dx = event.deltaX;
            this.paddle_target_x = event.touchPos[0];
            //this.paddle_vel_x = ((event.touchPos[0] - this.paddle.mid_x()) > 0 ? 1 : -1) * calc_x_vel_paddle() * 2;
            this.paddle_accel_x = (event.touchPos[0] - this.paddle.mid_x() > 0 ? 1 : -1) * calc_x_accel_paddle() * 3;
        });
        touchListener.registerCallBack("touchstart", () => true, (event) => {
            this.balls.forEach(ball => ball.release());
            this.paddle_accel_x = ((event.touchPos[0] - this.paddle.mid_x()) > 0 ? 1 : -1) * calc_x_accel_paddle() * 3;
        });
        touchListener.registerCallBack("touchend", () => true, (event) => {
            this.paddle_vel_x = 0;
            this.paddle_accel_x = 0;
        });
    }
    add_ball() {
        this.balls.push(new Ball(this.paddle.mid_x(), this.paddle.y - this.height * 0.05, this.height * 0.025));
    }
    init(width, height) {
        const bricks_across = 20;
        const brick_width = (width / bricks_across);
        const brick_height = (height * 0.05);
        for (let y = 0; y < 5 * brick_height; y += brick_height) {
            for (let x = 0; x < 19 * brick_width; x += brick_width) {
                this.bricks.push(new Brick(x, y, brick_width, brick_height));
            }
        }
    }
    resize(width, height) {
        const bricks_across = 20;
        const brick_width = (width / bricks_across);
        const brick_height = (height * 0.05);
        for (let i = 0; i < this.bricks.length; i++) {
            const brick = this.bricks[i];
            const px = brick.x / this.width;
            const py = brick.y / this.height;
            brick.x = px * width;
            brick.y = py * height;
            brick.width = brick_width;
            brick.height = brick_height;
        }
        this.paddle.width *= height > width ? 5 : 3;
        this.balls.forEach(ball => {
            const px = ball.x / this.width;
            const py = ball.y / this.height;
            ball.x = px * width;
            ball.y = py * height;
            ball.radius = height * 0.025;
            ball.width = ball.radius * 2;
            ball.height = ball.radius * 2;
        });
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
        if (this.bricks.length === 1) {
            this.init(this.width, this.height);
        }
        this.collision_map = new SpatialHashMap2D(this.balls.concat(this.bricks), [], this.width, this.height, 20, 20);
        this.collision_map.handle_by_cell((ball, brick) => {
            if (ball === this.paddle && brick.hp !== undefined && brick.hp <= 0) {
                const falling = brick;
                if (falling.hp <= 0) {
                    const tdb_index = this.bricks.indexOf(falling);
                    if (tdb_index >= 0)
                        this.bricks.splice(tdb_index, 1);
                }
            }
            else if (ball.radius && brick.collides_with_circle(ball)) {
                const b = ball;
                if (brick === this.paddle) {
                    if (b.direction[1] > 0) {
                        //b.direction[1] *= -1;
                        const angle = Math.round(((b.mid_x() - brick.x) / brick.width) * Math.PI * 20) / 20;
                        const mag = Math.sqrt(b.direction[0] * b.direction[0] + b.direction[1] * b.direction[1]);
                        b.direction[0] = Math.cos(angle) * mag * -1;
                        b.direction[1] = Math.sin(angle) * mag * -1;
                        b.y = brick.y - b.height;
                        if (b.direction[1] > -80)
                            b.direction[1] = -80;
                    }
                }
                else if (brick.hp > 0) {
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
                    /*if(bri.hp <= 0)
                    {
                        const tdb_index = this.bricks.indexOf(bri);
                        if(tdb_index >= 0)
                            this.bricks.splice(tdb_index, 1);
                    }*/
                }
            }
        }, (a, b) => { });
        for (let i = 0; i < this.balls.length; i++) {
            const ball = this.balls[i];
            ball.update_state(delta_time);
            const destroy_ball = ball.bounce(this.x, this.y, this.width, this.height);
            if (!ball.released()) {
                ball.x = this.paddle.mid_x() - ball.radius;
                ball.y = this.paddle.y - this.height * 0.05 - 5;
            }
            if (destroy_ball) {
                const ball_index = this.balls.indexOf(ball);
                if (ball_index !== -1)
                    this.balls.splice(ball_index, 1);
            }
        }
        if (this.balls.length === 0) {
            //this.bricks = [];
            this.add_ball();
            //this.init(this.height, this.width);
        }
        this.paddle_vel_x += Math.abs(this.paddle_vel_x) < this.paddle_target_vel_x ?
            this.paddle_accel_x * delta_time / 1000 :
            0;
        if ((!keyboardHandler.keysHeld["ArrowLeft"] && !keyboardHandler.keysHeld["ArrowRight"]))
            if (Math.abs(this.paddle.mid_x() - this.paddle_target_x) < this.paddle.width / 4) {
                this.paddle_vel_x /= 2;
                this.paddle_accel_x /= 2;
            }
        //if((keyboardHandler.keysHeld["ArrowLeft"] || keyboardHandler.keysHeld["ArrowRight"]))
        {
            this.paddle.x += this.paddle_vel_x * delta_time / 1000;
        }
        if (this.paddle.x > this.width) {
            this.paddle.x = -this.paddle.width;
        }
        if (this.paddle.x + this.paddle.width < 0) {
            this.paddle.x = this.width;
        }
        for (let i = 0; i < this.bricks.length; i++) {
            const bri = this.bricks[i];
            bri.update_state(delta_time);
            if (bri.mid_y() > this.width)
                this.bricks.splice(i, 1);
        }
    }
}
;
function calc_x_accel_paddle() {
    return calc_x_vel_paddle() * 2;
}
async function main() {
    const canvas = document.getElementById("screen");
    const touchListener = new SingleTouchListener(canvas, false, true, false);
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
    window.game = game;
    //setInterval(() => {for(let i = 0; i < 200; i++) game.add_ball(); game.balls.forEach(ball => ball.release());}, 50)
    keyboardHandler.registerCallBack("keydown", () => true, (event) => {
        switch (event.code) {
            case ("Space"):
                game.balls.forEach(ball => ball.release());
                break;
            case ("ArrowLeft"):
                game.paddle_accel_x = -calc_x_accel_paddle();
                //game.paddle_vel_x = -calc_x_vel_paddle();
                break;
            case ("ArrowRight"):
                game.paddle_accel_x = calc_x_accel_paddle();
                //game.paddle_vel_x = calc_x_vel_paddle();
                break;
            case ("ArrowUp"):
                break;
            case ("ArrowDown"):
                game.add_ball();
                break;
        }
    });
    keyboardHandler.registerCallBack("keyup", () => true, (event) => {
        switch (event.code) {
            case ("ArrowLeft"):
                if (game.paddle_vel_x < 0) {
                    game.paddle_vel_x = 0;
                    game.paddle_accel_x = 0;
                }
                break;
            case ("ArrowRight"):
                if (game.paddle_vel_x > 0) {
                    game.paddle_vel_x = 0;
                    game.paddle_accel_x = 0;
                }
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
            canvas.height = game.height - (isTouchSupported() ? 125 : 25);
            game.resize(canvas.width, canvas.height);
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
