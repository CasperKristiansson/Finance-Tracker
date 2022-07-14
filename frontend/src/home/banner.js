import React from "react";
import "./banner.css"

export default () => {
  return (
		<>
			<div className="waveWrapper waveAnimation">
				<div className="waveWrapperInner bgTop">
					<div className="wave waveTop" style={{backgroundImage: "url('http://front-end-noobs.com/jecko/img/wave-top.png')"}}></div>
				</div>
				<div className="waveWrapperInner bgMiddle">
					<div className="wave waveMiddle" style={{backgroundImage: "url('http://front-end-noobs.com/jecko/img/wave-mid.png')"}}></div>
				</div>
				<div className="waveWrapperInner bgBottom">
					<div className="wave waveBottom" style={{backgroundImage: "url('http://front-end-noobs.com/jecko/img/wave-bot.png')"}}></div>
				</div>
			</div>
			<div className="home-income-label">
				<h2>This Month</h2>
			</div>
			<div className="ui statistic home-income-label-left green">
				<div className="value">
					40,509 kr
				</div>
				<div className="label" style={{color: "#21BA45"}}>
					Income
				</div>
			</div>
			<div className="ui statistic home-income-label-right red">
				<div className="value">
					40,509 kr
				</div>
				<div className="label" style={{color: "#DB2828"}}>
					Expenses
				</div>
			</div>
		</>
  );
}