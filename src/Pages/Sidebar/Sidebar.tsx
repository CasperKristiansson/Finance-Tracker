import React from "react";
import 'react-pro-sidebar/dist/css/styles.css';
import { ProSidebar, Menu, MenuItem, SidebarHeader, SidebarFooter, SidebarContent, } from 'react-pro-sidebar';
import { FiSettings } from 'react-icons/fi';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Link } from 'react-router-dom';
import { faFileCircleCheck, faMoneyBillWave , faUser, faTrophy, faDownload, faPaperclip} from '@fortawesome/free-solid-svg-icons'
import { createUseStyles } from "react-jss";

const useStyles = createUseStyles({
	sidebar: {
		position: "fixed",
		color: "#B3B8D4",
	},
	sidebarHeader: {
		backgroundColor: "#0c1e35 !important",
	},
	sidebarFooter: {
		backgroundColor: "#0c1e35 !important",
		textAlign: 'center',
	},
	sidebarContent: {
		backgroundColor: "#0c1e35 !important",
	},
	sidebarLogo: {
		padding: "5px 0px",
		fontWeight: "bold",
		letterSpacing: "1px",
	},
	sidebarLogoH1: {
		fontSize: 30,
		textAlign: "center",
		padding: "20px 0px",
	},
	sidebarBtnWrapper: {
		display: "flex",
		alignItems: "center",
		justifyContent: "center",
	},
	sidebarBtn: {
		transition: "width 0.3s",
		width: 150,
		padding: "1px 15px",
		borderRadius: 40,
		background: "#18293F",
		color: "#adadad",
		textDecoration: "none",
		margin: "0 auto",
		height: 35,
		display: "flex",
		alignItems: "center",
		justifyContent: "center",
		textOverflow: "ellipsis",
		overflow: "hidden",
		"&:hover": {
			background: "#dee2ec",
			color: "#18293F",
		},
	},
	sidebarBtnWrapperSpan: {
		marginLeft: 5,
		fontSize: 15,
	},
	iconWrapper: {
		'& .pro-icon-wrapper': {
			backgroundColor: "#18293F !important",
		}
	},
});

export const Sidebar: React.FC<{}> = (): JSX.Element => {
	const classes = useStyles();

	return(
		<ProSidebar breakPoint="md" className={classes.sidebar}>
			<SidebarHeader className={classes.sidebarHeader}>
				<div className={classes.sidebarLogo}>
					<h1 className={classes.sidebarLogoH1}>FinanceTracker</h1>
				</div>
			</SidebarHeader>

			<SidebarContent className={classes.sidebarContent}>
				<Menu iconShape="circle" className={classes.iconWrapper}>
					<MenuItem icon={<FontAwesomeIcon icon={faMoneyBillWave} />}>
						Overview
						<Link to="/" />
					</MenuItem>
					<MenuItem icon={<FontAwesomeIcon icon={faFileCircleCheck} />}>
						Yearly Report
						<Link to="/yearlyReport" />
					</MenuItem>
					<MenuItem icon={<FontAwesomeIcon icon={faFileCircleCheck} />}>
						Total Report
						<Link to="/totalReport" />
					</MenuItem>
					<MenuItem icon={<FontAwesomeIcon icon={faPaperclip} />}>
						Transactions View
						<Link to="/transactionsView" />
					</MenuItem>
					<MenuItem icon={<FontAwesomeIcon icon={faUser} />}>
						Accounts Report
						<Link to="/accountsReport" />
					</MenuItem>
					<MenuItem icon={<FontAwesomeIcon icon={faTrophy} />}>
						Milestones
						<Link to="/milestones" />
					</MenuItem>
				</Menu>

				<Menu iconShape="circle" className={classes.iconWrapper} >
					<MenuItem icon={<FontAwesomeIcon icon={faUser} />}>
						Accounts
						<Link to="/accounts" />
					</MenuItem>
					<MenuItem icon={<FontAwesomeIcon icon={faDownload} />}>
						Download
						<Link to="/download" />
					</MenuItem>
				</Menu>
			</SidebarContent>

			<SidebarFooter className={classes.sidebarFooter}>
        <div
          className={classes.sidebarBtnWrapper}
          style={{
            padding: '20px 24px',
          }}
        >
				<a
				href="https://github.com/CasperKristiansson/Finance-Tracker"
				target="_blank"
				className={classes.sidebarBtn}
				rel="noopener noreferrer"
				>
					<FiSettings />
					<span style={{ whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }} className={classes.sidebarBtnWrapperSpan}>
						Settings
					</span>
				</a>
        </div>
      </SidebarFooter>
    </ProSidebar>
	);
};
