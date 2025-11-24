// internal globals
/**
 * @type {Component[]}
 * */
const COMPONENT_REGISTRY = [];
/**
 * @type {undefined|number}
 * */
let UNIQUE_ID_STORE = undefined;

window.onload = () => {afterLoad()};

function afterLoad() {
    const reg = document.getElementById("components");
    for (const e of reg.children) {
        COMPONENT_REGISTRY.push(new Component(e.id));
    }
    reg.remove();
    importSyntheticComponents();
    populateItems();
    render_page();
}

function importSyntheticComponents() {
    const make_component = (id, content) => { COMPONENT_REGISTRY.push(new Component(id, false, content)); };

    make_component("div", "<div>%</div");
    make_component("p", "<p>%</p");
    make_component("label", "<label> % </label>");
    make_component("span", "<span> % </span>");
    make_component("a", "<a href=\"%\"> % </a>");
    make_component("row", "<div class='row'> % </div>");
}

// ---------------------------------------------------------------------------------------------------------------
// types


class Component {
    constructor(id, is_err=false, pre_content=undefined) {
        this.is_err = is_err;
        if(is_err) {
            this.error = id;
        } else {
            this.id = id;
            this.parts = (pre_content === undefined ? document.getElementById(id).innerHTML : pre_content).split('%');
            this.params_count = this.parts.length - 1;
        }
    }

    /**
     * @param {boolean} include_id
     * @param {undefined|string} id
     * @param {string|BCResult} params
     * @return BCResult
     * */
    build_with_id(include_id, id=undefined, ...params) {
        if(this.is_err) {
            return this.error;
        }
        if(this.params_count !== params.length) {
            console.error("[COMPONENT SYSTEM] invalid parameter count, excepted " + this.params_count + " got " + params.length + " | component id='"+this.id+"'");
            return new BCResult(this.id, "<s> invalid parameter count, expected " + this.params_count + " got " + params.length + " </s>", undefined);
        }
        let result = this.parts[0];
        for(let i= 0; i < this.params_count; i++) {
            result += params[i] instanceof BCResult ? params[i].content : params[i];
            result += this.parts[i+1];
        }

        if (include_id === true) {
            // SLOW version
            // const dom = new DOMParser().parseFromString("<div id='UNIQUE_SELECTOR'>" + result + "</div>", "text/html");
            // let rs = dom.getElementById("UNIQUE_SELECTOR");

            let wrapper= document.createElement('div');
            wrapper.innerHTML= result;
            let rs= wrapper.children[0];


            if(id === undefined) {
                if(UNIQUE_ID_STORE === undefined) {
                    UNIQUE_ID_STORE = Date.now();
                } else {
                    UNIQUE_ID_STORE += 1;
                }
                rs.id = "e_" + UNIQUE_ID_STORE.toString();
            } else {
                rs.id = id;
            }

            // SLOW version
            // return new BCResult(this.id, rs.outerHTML, rs.id);
            return new BCResult(this.id, wrapper.innerHTML, rs.id);
        }
        return new BCResult(this.id, result, undefined);
    }

    build(...params) { return this.build_with_id(false, undefined, ...params); }
}

class BCResult {
    constructor(component_id, content, unique_id=undefined) {
        this.content = content;
        this.component_id = component_id;
        this.unique_id = unique_id;
    }
    /**
     * @param {string} [parent_id="body"]
     * */
    append(parent_id="body") { document.getElementById(parent_id).innerHTML += this.content }
    rerender(...params) {
        if (this.unique_id === undefined) {
            console.error("not updatable, id='" + this.unique_id + "'");
            return;
        }
        const new_c = get_component(this.component_id).build_with_id(true, this.unique_id, ...params);
        document.getElementById(this.unique_id).outerHTML = new_c.content;
    }
    /**
     * @param {string|BCResult} addition
     * */
    additive_rerender(addition) {
        if (this.unique_id === undefined) {
            console.error("not updatable, id='" + this.unique_id + "'");
            return;
        }
        document.getElementById(this.unique_id).innerHTML += addition instanceof BCResult ? addition.content : addition;
    }
    /**
     * @return void
     * @param {boolean} visible
     * */
    setVisible(visible) {
        if (this.unique_id === undefined) {
            console.error("not updatable, id='" + this.unique_id + "'");
            return;
        }
        if(visible) {
            document.getElementById(this.unique_id).classList.remove("hide");
        } else {
            document.getElementById(this.unique_id).classList.add("hide");
        }
    }

    /**
     * deletes item
     * */
    remove() {
        if (this.unique_id === undefined) {
            console.error("not updatable, id='" + this.unique_id + "'");
            return;
        }
        const item = document.getElementById(this.unique_id);
        if (item !== null)
            item.remove();
    }
}

/**
 * @return Component
 * @param {string} id
 * */
function get_component(id) {
    const rs = COMPONENT_REGISTRY.find((n) => n.id === id);
    if (rs === undefined)
        return new Component("<s> component not found id='"+id+"'  </s>", true);
    return rs;
}

// ---------------------------------------------------------------------------------------------------------------
// public component functions

/**
 * @return BCResult
 * @param {string} id
 * @param {string|BCResult} params
 * */
const make = (id, ...params) => get_component(id).build(...params);
/**
 * @return BCResult
 * @param {string} id
 * @param {string|BCResult} params
 * */
const make_updatable = (id, ...params) => get_component(id).build_with_id(true, undefined, ...params);
/**
 * @return string
 * @param {string|BCResult} items
 * */
const join = (...items) => items.map((v) => v instanceof BCResult ? v.content : v).join("\n");

// ---------------------------------------------------------------------------------------------------------------
// page code


class Item  {
    /**
     * @param {String} id
     * @param {String} name
     * @param {String} description
     * @param {Number} price
     * @param {String} image_url
     *
     * @property {String} id
     * @property {String} name
     * @property {String} description
     * @property {Number} price
     * @property {String} image_url
     * @property {BCResult|undefined} buy_or_modify_holder
     * */
    constructor(id, name, description, price, image_url) {
        this.id = id;
        this.name = name;
        this.description = description;
        this.price = price;
        this.image_url = image_url;
        this.buy_or_modify_holder = undefined;
    }
    build_component() {
        let btn = make_updatable("div", make("items-item-buy-btn", this.id));
        this.buy_or_modify_holder = btn;
        return make("items-item", this.image_url, this.name, this.description, this.price.toString(), btn);
    }
}

let items_container;

/**
 * @type {Map<String,Item>}
 * */
const ITEMS = new Map();
function populateItems() {
    let id_cnt = 1;
    const make = (name, description, price, image_url) => {
        ITEMS.set("i"+id_cnt.toString(), new Item("i"+id_cnt.toString(), name, description, price, image_url));
        id_cnt++;
    };

    make("Item1", "description", 10, "/img/cat.png");
    make("Item2", "description", 100, "/img/cat.png");
    make("Martin", "mr", 10000, "/img/cat.png");
}



/**
 * @type {BCResult}
 * */
let counter_obj;
let counter = 0;


let basktet_cnt;

/**
 * @type {BCResult}
 * */
let modal_basket;

let basket_total1;
let basket_total2;
let modal_checkout_btn;

// call on initialization
function render_page() {
    counter_obj = make_updatable("p", "count = " + counter);

    make("container", join(
        counter_obj,
    )).append("dbg");

    modal_basket = make_updatable("div", "empty");

    basktet_cnt = 0;

    basket_total1 = make_updatable("span", basktet_cnt.toString());
    basket_total2 = make_updatable("span", basktet_cnt.toString());
    modal_checkout_btn = make_updatable("modal-checkout-btn", "disabled");

    make("navbar", "Shop", basket_total1, make("basket-icon"), modal_basket, basket_total2, modal_checkout_btn)
        .append("nav");

    make("footer")
        .append("foot");

    items_container = make_updatable("row", "");

    make("items-container", items_container).append();


    for(const [id, item] of ITEMS) {
        items_container.additive_rerender(item.build_component());
    }
}


/**
 * @type {Map<String, Number>} Map<id, count>
 */
const BASKET_ITEMS = new Map();
/**
 * @type {Map<String, BCResult>} Map<id, updatable>
 */
const BASKET_MODAL_HANDLES = new Map();


/**
 * calculates current basket price
 * @return {number}
 */
const calc_price = () => BASKET_ITEMS.entries().map(([k, v]) => ITEMS.get(k).price * v).reduce((p, c) => p + c, 0);

function rerender_basket_price() {
    // update price
    const price = calc_price();
    basktet_cnt = price;
    basket_total1.rerender((price).toString());
    basket_total2.rerender((price).toString());
    // update modal

    // used for adding items:
    // modal_basket.additive_rerender(make("modal-item", "counter_"+counter, counter.toString()));
}

function display_empty_if_basket_empty(old_price, new_price) {
    if (old_price === 0) {
        modal_basket.rerender("");
        modal_checkout_btn.rerender("");
    }
    if(new_price === 0) {
        modal_basket.rerender("empty");
        modal_checkout_btn.rerender("disabled");
    }
}

/**
 * @param {String} id
 * */
function action_item_buy(id) {
    console.log("called action_item_buy with id='"+id+"'");
    display_empty_if_basket_empty(basktet_cnt,1);

    BASKET_ITEMS.set(id, 1);

    rerender_basket_price();

    let modal_updt = make_updatable("modal-item", "", ITEMS.get(id).name, ITEMS.get(id).price.toString());

    BASKET_MODAL_HANDLES.set(id, modal_updt);
    modal_basket.additive_rerender(modal_updt);

    // update buy button to quantity changer
    ITEMS.get(id).buy_or_modify_holder.rerender(make("items-item-buy-modify", id, id, id, id, id, id, id, id, id, id, id, id));
}

/**
 * @param {String} id
 * */
function action_item_remove(id) {
    console.log("called action_item_remove with id='"+id+"'");
    BASKET_ITEMS.delete(id);
    if(BASKET_MODAL_HANDLES.has(id)) {
        BASKET_MODAL_HANDLES.get(id).remove();
        BASKET_MODAL_HANDLES.delete(id);
    }
    rerender_basket_price();
    ITEMS.get(id).buy_or_modify_holder.rerender(make("items-item-buy-btn", id));

    display_empty_if_basket_empty(1, basktet_cnt);
}

/**
 * @param {String} id
 * @param {number} qty
 * */
function action_item_update(id, qty) {
    console.log("called action_item_update with id='"+id+"', qty="+qty.toString());
    BASKET_ITEMS.set(id, qty);
    rerender_basket_price();
    BASKET_MODAL_HANDLES.get(id).rerender(qty === 1 ? "" : qty.toString()+"x", ITEMS.get(id).name, (ITEMS.get(id).price * qty).toString());
}

