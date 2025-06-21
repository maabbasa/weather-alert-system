import sys
from awsglue.transforms import *
from awsglue.utils import getResolvedOptions
from pyspark.context import SparkContext
from awsglue.context import GlueContext
from awsglue.job import Job

# Init
args = getResolvedOptions(sys.argv, ['JOB_NAME'])
sc = SparkContext()
glueContext = GlueContext(sc)
spark = glueContext.spark_session
job = Job(glueContext)
job.init(args['JOB_NAME'], args)

# Load JSON from S3
raw_df = glueContext.create_dynamic_frame.from_options(
    format_options={"multiline": False},
    connection_type="s3",
    format="json",
    connection_options={
        "paths": ["s3://weatheralertsystemstack-rawweatherdata95bd72b5-lyqdvzls62r4/weather/"],
        "recurse": True
    }
)

# Optional: clean/rename/flatten columns
flattened_df = raw_df.relationalize("root", "s3://temp-bucket/temp/")
main_df = flattened_df.select("root")

# Save as Parquet (structured)
glueContext.write_dynamic_frame.from_options(
    frame=main_df,
    connection_type="s3",
    connection_options={"path": "s3://weatheralertsystemstack-starschemadata96b36313-shxhruxmmcyq/"},
    format="parquet"
)

job.commit()
