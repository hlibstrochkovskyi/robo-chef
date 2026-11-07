import "./style.css";
import { Kitchen } from "./scene";
document.querySelector("#app")!.innerHTML = '<div id="scene"></div>';
new Kitchen(document.getElementById("scene")!);
