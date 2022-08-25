

(function (global) {
    const LiteGraph = global.LiteGraph;

    LiteGraph.allow_multi_output_for_events = true;
    LiteGraph.draw_invisible_connections = true;

    const HIDDEN_CONNECTION = { visible: false };

    const CONTEXT_CONNECTION = 'context';
    const STATEMENTS_CONNECTION = 'stmts';

    // render as transparent node with thin border only
    class Action {
        static title = "Action";
        static desc = "If statement.";
        // static title_mode = LiteGraph.TRANSPARENT_TITLE;
        // static title_mode = LiteGraph.NO_TITLE;
        // static color = 'transparent';
        static bgcolor = 'transparent';
        static can_be_dropped = true;
        static can_accept_drop = true;
        static collapsable = false;

        readyToAccept = false;

        constructor() {
            this.addInput("cond", "bool", { pos: [15, -15], label: "" });
            this.addInput(CONTEXT_CONNECTION, LiteGraph.ACTION, HIDDEN_CONNECTION);
            this.addOutput('true', LiteGraph.EVENT, HIDDEN_CONNECTION);
            this.addOutput('false', LiteGraph.EVENT, HIDDEN_CONNECTION);
            this.update();
        }

        computeSize() {
            return [130, 52];
        }

        dependentNodes() {
            return [...(this.getOutputNodes(0) || []), ...(this.getOutputNodes(1) || [])];
        }

        update() {
            const dx = 20;
            const dy = 10;
            const dh_title = 35;
            const dh_notitle = 5;

            let [w, h] = this.computeSize();
            let [x, y] = [dx, h];

            const nodes = this.dependentNodes();

            // if (this.readyToAccept) {
            //     if (!nodes?.length) {
            //         // no nodes - increase for two slots
            //         y += (50 + 5) * 2;
            //     } else {
            //         // increase if slot is available
            //         if (nodes.length == 1) {
            //             y += (50 + 5);
            //         }
            //     }
            // }

            if (nodes) {
                for (let node of nodes) {
                    const noTitle = node.constructor.title_mode == LiteGraph.NO_TITLE;
                    
                    const px = this.pos[0] + x;
                    const py = this.pos[1] + y + (noTitle ? dh_notitle : dh_title);

                    if (node.pos[0] != px || node.pos[1] != py) {
                        node.pos = [px, py];
                        node.onReposition?.();
                    }

                    w = Math.max(w, node.size[0] + dx * 2);
                    y = y + 
                        node.size[1] + 
                        (!noTitle ? LiteGraph.NODE_TITLE_HEIGHT : 0) + 
                        dy;
                }
            } 
            
            w = Math.max(100, w);
            h = Math.max(30, y);

            if (this.size[0] != w || this.size[1] != h) {
                this.size = [w, h];
                this.onResize();
            }

            return nodes;
        }


        onDropMove(node, pos, canvas) {
            const nodes = this.dependentNodes();

            if (nodes) {
                for (let node of nodes) {
                    if (pos.y > (node.pos[1] - this.pos[1])) {
                        break;
                    }
                }
            }
        }

        onResize() {
            this.getInputNode(1)?.update?.();
        }

        onReposition() {
            this.getInputNode(1)?.update?.();
        }

        highlight(value) {
            this.readyToAccept = value;
        }

        // including draw circle to collapse tile 
        onDrawTitleBox(
            ctx, 
            titleHeight, 
            size, 
            scale
        ) {
        }

        onDrawBackground(
            ctx         /* CanvasRenderingContext2D */,
            gcanvas     /* LGraphCanvas */,
            canvas      /* HTMLCanvasElement */,
            mouse
        ) {
            // super.onDrawBackground(ctx, gcanvas, canvas, mouse);

            if (this.flags.collapsed)
                return;

            let [w, h] = this.size;
            
            ctx.save();

            // const nodes = this.dependentNodes();
            // if (!nodes?.length && this.readyToAccept) {
            //     const [ w0, h0 ] = this.computeSize();

            //     ctx.beginPath();
            //     ctx.strokeStyle = 'orange';
            //     ctx.rect(5, h0, w + 1 - 10, 50);
            //     ctx.stroke();
            //     ctx.closePath();

            //     ctx.beginPath();
            //     ctx.strokeStyle = 'orange';
            //     ctx.rect(5, h0 + 55, w + 1 - 10, 50);
            //     ctx.stroke();
            //     ctx.closePath();
            // }

            ctx.beginPath();
            ctx.strokeStyle = this.readyToAccept ? 'orange' : 'rgba(255, 255, 255, 0)';
            ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
            ctx.shadowColor = "#000";
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;
            ctx.shadowBlur = 6;
            ctx.roundRect(0, 0, w + 1, h, [0, 0, 5, 5], 5);
            ctx.stroke();
            ctx.fill();
            ctx.closePath();
            ctx.restore();
        }


        onDropEnter(node) {
            this.highlight(true);
            this.update();
        }


        onDropLeave(node) {
            this.highlight(false);

            const graph = this.graph;
            for (let i of [0, 1]) {
                const links = this.outputs[i].links;

                if (links) {
                    // trying to find incoming node within our connections
                    // and disconnect if possible
                    links.forEach(link_id => {
                        let link = graph.links[link_id];
                        let targetNode = graph.getNodeById(link.target_id);
                        if (node == targetNode) {
                            this.disconnectOutput(i, targetNode);
                        }
                    });
                }
            }

            // true is disconnected and false is connected
            const conseq = this.outputs[0].links;
            const contrary = this.outputs[1].links;
            if (!conseq?.length && contrary?.length) {
                // move false to true
                let link = graph.links[contrary[0]];
                let contraryNode = graph.getNodeById(link.target_id);
                this.disconnectOutput(1);
                this.connect(0, contraryNode, CONTEXT_CONNECTION);
            }

            this.update();
        }


        onDrop(node) {
            // todo: validate node
            const slotName = this.isOutputConnected(0) 
                ? this.isOutputConnected(1) 
                    ? null 
                    : 'false'
                : 'true';
            if (slotName) {
                this.connect(slotName, node, CONTEXT_CONNECTION);
            }
            this.highlight(false);
            this.update();
        }


        onDrag(graphcanvas) {
            const nodes = this.update();
            if (nodes) {
                nodes.forEach(node => {
                    graphcanvas.bringToFront(node)
                    if (node.onDrag) node.onDrag(graphcanvas);
                });
            }
        }


        onConnectionsChange() {
            this.update();
            // force update parent twice in order to validate that all nodes in positions
            this.onResize();
        }


        onBringToFront(canvas) {
            const nodes = this.dependentNodes();
            if (nodes) {
                nodes.forEach(node => {
                    canvas.bringToFront(node);
                    if (node.onBringToFront)
                        node.onBringToFront(canvas);
                });
            }
        }
    }

    LiteGraph.registerNodeType("action", Action);


    class PartInit {
        static title = "Part init";
        static desc = "Particle initializer.";
        static title_mode = LiteGraph.TRANSPARENT_TITLE;
        static color = 'transparent';
        static bgcolor = 'transparent';
        static can_accept_drop = true;
        static collapsable = false;
        static title_offset_x = 5;
        // static slot_start_y = 40;

        readyToAccept = false;

        constructor() {
            this.addOutput(STATEMENTS_CONNECTION, LiteGraph.EVENT, HIDDEN_CONNECTION);
            this.size = this.computeSize();
        }

        dependentNodes() {
            return this.getOutputNodes(0);
        }

        update() {
            const dx = 20;
            const dy = 10;
            const dh_title = 35;
            const dh_notitle = 5;

            let [w, h] = [0, 0];
            let [x, y] = [dx, 0];

            const nodes = this.dependentNodes();
            if (nodes) {
                for (let node of nodes) {
                    const noTitle = node.constructor.title_mode == LiteGraph.NO_TITLE;
                    node.pos[0] = this.pos[0] + x;
                    node.pos[1] = this.pos[1] + y + (noTitle ? dh_notitle : dh_title);

                    w = Math.max(w, node.size[0] + dx * 2);
                    y = y + 
                        node.size[1] + 
                        (!noTitle ? LiteGraph.NODE_TITLE_HEIGHT : 0) + 
                        dy;
                }
            }
            
            w = Math.max(100, w);
            h = Math.max(30, y);

            this.size = [w, h];
            return nodes;
        }
        

        highlight(value) {
            this.readyToAccept = value;
        }


        onDrawBackground(
            ctx         /* CanvasRenderingContext2D */,
            gcanvas     /* LGraphCanvas */,
            canvas      /* HTMLCanvasElement */,
            mouse
        ) {
            // super.onDrawBackground(ctx, gcanvas, canvas, mouse);

            if (this.flags.collapsed)
                return;

            let [w, h] = this.size;
            
            ctx.save();

            ctx.save();
            ctx.beginPath();
            ctx.strokeStyle = this.readyToAccept ? 'orange' : 'rgba(255, 255, 255, 0)';
            ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
            ctx.shadowColor = "#000";
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;
            ctx.shadowBlur = 6;
            ctx.roundRect(0, 0, w, h, [0, 0, 5, 5], 5);
            ctx.stroke();
            ctx.fill();
            ctx.closePath();
            ctx.restore();
            
            if (this.mouseOver) {
                ctx.fillStyle = "#AAA";
                ctx.fillText(PartInit.desc, 0, this.size[1] + 14);
            }

            ctx.restore();
        }


        onDropEnter(node) {
            this.highlight(true);
        }


        onDropLeave(node) {
            this.highlight(false);

            const graph = this.graph;
            const links = this.outputs[0].links || [];

            // trying to find incoming node within our connections
            // and disconnect if possible
            links.forEach(link_id => {
                let link = graph.links[link_id];
                let targetNode = graph.getNodeById(link.target_id);
                if (node == targetNode) {
                    this.disconnectOutput(0, targetNode);
                    this.update();
                }
            })
        }


        onDrop(node) {
            // todo: validate node
            if (this.connect(STATEMENTS_CONNECTION, node, CONTEXT_CONNECTION)) {
                this.update();
                this.highlight(false);
            }
        }


        onDrag(canvas) {
            const nodes = this.update();
            if (nodes) {
                nodes.forEach(node => canvas.bringToFront(node))
            }
        }

        onConnectionsChange() {
            this.update();
        }

        onBringToFront(canvas) {
            const nodes = this.dependentNodes();
            if (nodes) {
                nodes.forEach(node => canvas.bringToFront(node))
            }
        }

        onDrawTitleBar(
            ctx             /* CanvasRenderingContext2D */, 
            titleHeight     /* float */,
            size            /* [float, float] */,
            scale           /* float */,
            fgColor         /* string */
        ) {
            let title_height = LiteGraph.NODE_TITLE_HEIGHT;
            ctx.beginPath();
            ctx.fillStyle = 'rgba(125, 125, 125, 0.5)';
            ctx.rect(0, -title_height, this.size[0], title_height);
            ctx.fill();
            ctx.closePath();
        }

        // including draw circle to collapse tile 
        onDrawTitleBox(
            ctx, 
            titleHeight, 
            size, 
            scale
        ) {
            // let box_size = 10;
            // let title_height = LiteGraph.NODE_TITLE_HEIGHT;
            // ctx.fillStyle = LiteGraph.NODE_DEFAULT_BOXCOLOR;
            // ctx.beginPath();
            // ctx.arc(
            //     title_height * 0.5,
            //     title_height * -0.5,
            //     box_size * 0.5,
            //     0,
            //     Math.PI * 2
            // );
            // ctx.fill();
            // ctx.closePath();
        }

        // onDrawTitleText(
        //     ctx, 
        //     titleHeight, 
        //     size, 
        //     scale,
        //     font,
        //     selected
        // ) {
        //     
        // }

        onBounding(rect) {
            if (!this.flags.collapsed && this.mouseOver)
                rect[3] = this.size[1] + 20;
        }
    }

    LiteGraph.registerNodeType("test", PartInit);
})(this);
