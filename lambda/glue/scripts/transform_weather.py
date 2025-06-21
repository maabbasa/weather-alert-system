import sys
from awsglue.transforms import *
from awsglue.utils import getResolvedOptions
from pyspark.context import SparkContext
from awsglue.context import GlueContext
from awsglue.job import Job

args = getResolvedOptions(sys.argv, ['JOB_NAME'])
sc = SparkContext()
glueContext = GlueContext(sc)
spark = glueContext.spark_session
job = Job(glueContext)
job.init(args['JOB_NAME'], args)

# Read JSON weather files from raw bucket
datasource = glueContext.create_dynamic_frame.from_options(
    connection_type="s3",
    connection_options={"paths": ["s3://weatheralertsystemstack-rawweatherdata95bd72b5-lyqdvzls62r4/weather/"]},
    format="json"
)

# Transform into star schema here (placeholder logic)
transformed = datasource

# Write to star schema bucket
glueContext.write_dynamic_frame.from_options(
    frame=transformed,
    connection_type="s3",
    connection_options={"path": "s3://weatheralertsystemstack-starschemaweatherbucket11d-v9eqt30fepe5/"},
    format="parquet"
)

job.commit()
