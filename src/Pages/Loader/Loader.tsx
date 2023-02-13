import { createUseStyles } from "react-jss";
import { PropagateLoader } from "react-spinners";

const useStyles = createUseStyles({
    loaderWrapper: {
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        marginLeft: 270,
        height: "100%",
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        zIndex: 9999999999,
    },
    loader: {
        position: "absolute",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
    },
});


export const Loader: React.FC<{ loading: boolean }> = ({ loading }): JSX.Element => {
    const classes = useStyles();

    return(
        <>
            {loading && (
                <div className={classes.loaderWrapper}>
                   <PropagateLoader color={"#0C1E35"} loading={loading} size={15} className={classes.loader} /> 
                </div>
            )}
        </>
    );
}